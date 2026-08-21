'use client';

import { InvalidApiKeyError } from '@/lib/errors';
import { BudgetExceededError, RateLimitError } from '@/lib/openai-client';
import type { VideoService } from '@/lib/video-service';
import type { VideoJob } from '@/types/video';
import * as React from 'react';

const POLL_INTERVAL_MS = 15_000;

function rateLimitRetryMs(error: RateLimitError) {
    const retryAt = error.retryAt;
    if (!retryAt) return 30_000;

    const asSeconds = Number(retryAt);
    if (Number.isFinite(asSeconds)) return Math.max(1_000, asSeconds * 1000);

    const asDate = Date.parse(retryAt);
    if (Number.isFinite(asDate)) return Math.max(1_000, asDate - Date.now());

    return 30_000;
}

interface VideoJobCallbacks {
    /** Progress/status tick for a still-running job. */
    onProgress: (job: VideoJob) => void;
    /** Job finished; already removed from the active set when this fires. */
    onCompleted: (job: VideoJob) => void;
    /** Job failed; already removed from the active set when this fires. */
    onFailed: (job: VideoJob) => void;
    onInvalidKey: () => void;
}

function isTerminal(job: VideoJob) {
    return job.status === 'completed' || job.status === 'failed';
}

function isRateLimitError(error: unknown) {
    return Boolean(error && typeof error === 'object' && (error as { status?: number }).status === 429);
}

/**
 * Owns the set of in-flight jobs and the single polling interval that watches
 * them. `temp_`-prefixed ids are optimistic placeholders shown before the
 * gateway assigns a real id — they are never polled. Resume is driven from
 * cloud-synced history (page.tsx restores every 'processing' item), so no
 * local persistence of active ids is needed anymore.
 *
 * The poll loop reads everything through refs (jobs, service, callbacks), so
 * it always sees current state without the interval being torn down and
 * recreated on every render — the old inline version needed an
 * eslint-disable'd dependency list to avoid exactly that.
 */
export function useVideoJobs(service: VideoService, callbacks: VideoJobCallbacks) {
    const [activeJobs, setActiveJobs] = React.useState<Map<string, VideoJob>>(new Map());
    const activeJobsRef = React.useRef(activeJobs);
    const serviceRef = React.useRef(service);
    const callbacksRef = React.useRef(callbacks);
    const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const rateLimitedUntilRef = React.useRef(0);
    const nextPollIndexRef = React.useRef(0);

    React.useEffect(() => {
        activeJobsRef.current = activeJobs;
    }, [activeJobs]);
    React.useEffect(() => {
        serviceRef.current = service;
    }, [service]);
    React.useEffect(() => {
        callbacksRef.current = callbacks;
    }, [callbacks]);

    /** Stable key over non-temp, still-running ids — the polling effect's only dependency. */
    const activeJobIdsKey = React.useMemo(() => {
        return Array.from(activeJobs.entries())
            .filter(([id, job]) => !id.startsWith('temp_') && !isTerminal(job))
            .map(([id]) => id)
            .join('|');
    }, [activeJobs]);

    const addJob = React.useCallback((job: VideoJob) => {
        setActiveJobs((prev) => {
            return new Map(prev).set(job.id, job);
        });
    }, []);

    /** Swap the optimistic temp entry for the gateway-assigned job. */
    const replaceJob = React.useCallback((tempId: string, job: VideoJob) => {
        setActiveJobs((prev) => {
            const next = new Map(prev);
            next.delete(tempId);
            next.set(job.id, job);
            return next;
        });
    }, []);

    const removeJob = React.useCallback((id: string) => {
        setActiveJobs((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    /** Bulk-restore jobs rebuilt from history on page load. */
    const restoreJobs = React.useCallback((jobs: VideoJob[]) => {
        if (!jobs.length) return;
        setActiveJobs((prev) => {
            const next = new Map(prev);
            for (const job of jobs) next.set(job.id, job);
            return next;
        });
    }, []);

    const clearJobs = React.useCallback(() => {
        setActiveJobs(new Map());
    }, []);

    const pollAllJobs = React.useCallback(async () => {
        if (Date.now() < rateLimitedUntilRef.current) return;

        const currentRealJobs = Array.from(activeJobsRef.current.entries()).filter(
            ([id, job]) => !id.startsWith('temp_') && job.status !== 'completed' && job.status !== 'failed'
        );

        if (currentRealJobs.length === 0) return;

        const index = nextPollIndexRef.current % currentRealJobs.length;
        nextPollIndexRef.current = (index + 1) % currentRealJobs.length;
        const [jobId, knownJob] = currentRealJobs[index];

        try {
            const update = await serviceRef.current.retrieveVideo(jobId);
            // The gateway echoes provider-shaped values; keep the richer
            // display fields we set at submit time.
            const merged: VideoJob = {
                ...update,
                prompt: knownJob.prompt || update.prompt,
                size: knownJob.size || update.size,
                seconds: knownJob.seconds || update.seconds,
                remix_of: knownJob.remix_of || update.remix_of
            };

            if (merged.status === 'completed' || merged.status === 'failed') {
                // Mark terminal in the map FIRST so a slow callback (the
                // completion path downloads the video) can't race the next
                // poll tick into handling the same job twice. The entry
                // stays as a display job — deleting it used to blank the
                // output panel the moment a video finished.
                setActiveJobs((prev) => {
                    const next = new Map(prev);
                    next.set(jobId, merged);
                    return next;
                });
                if (merged.status === 'completed') {
                    callbacksRef.current.onCompleted(merged);
                } else {
                    callbacksRef.current.onFailed(merged);
                }
            } else {
                setActiveJobs((prev) => {
                    if (!prev.has(jobId)) return prev;
                    const next = new Map(prev);
                    next.set(jobId, merged);
                    return next;
                });
                callbacksRef.current.onProgress(merged);
            }
        } catch (err) {
            if (err instanceof InvalidApiKeyError) {
                clearJobs();
                callbacksRef.current.onInvalidKey();
                return;
            }
            if ((err as { status?: number }).status === 404) {
                // The task record no longer exists (Ark keeps them ~7
                // days) — terminal, or this id would poll forever.
                const failed: VideoJob = {
                    ...knownJob,
                    status: 'failed',
                    error: { message: 'Job not found on the gateway — the task record likely expired.' }
                };
                setActiveJobs((prev) => {
                    const next = new Map(prev);
                    next.set(jobId, failed);
                    return next;
                });
                callbacksRef.current.onFailed(failed);
                return;
            }
            if (err instanceof RateLimitError || isRateLimitError(err)) {
                // Temporary per-key RPM exhaustion. Keep the job active;
                // the next interval will retry after the gateway resets.
                const delay = err instanceof RateLimitError ? rateLimitRetryMs(err) : 30_000;
                rateLimitedUntilRef.current = Math.max(rateLimitedUntilRef.current, Date.now() + delay);
                return;
            }
            if (err instanceof BudgetExceededError) {
                const failed: VideoJob = {
                    ...knownJob,
                    status: 'failed',
                    error: { message: err.message }
                };
                setActiveJobs((prev) => {
                    const next = new Map(prev);
                    next.set(jobId, failed);
                    return next;
                });
                callbacksRef.current.onFailed(failed);
                return;
            }
            console.error(`Error polling job ${jobId}:`, err);
        }
    }, [clearJobs]);

    React.useEffect(() => {
        const hasActiveJobs = activeJobIdsKey.length > 0;

        if (!hasActiveJobs) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        if (!intervalRef.current) {
            void pollAllJobs();
            intervalRef.current = setInterval(() => void pollAllJobs(), POLL_INTERVAL_MS);
        }
    }, [activeJobIdsKey, pollAllJobs]);

    // Stop polling on unmount.
    React.useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);

    return { activeJobs, addJob, replaceJob, removeJob, restoreJobs, clearJobs };
}
