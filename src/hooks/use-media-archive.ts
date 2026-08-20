'use client';

import { ArchiveSourceFetchError, archiveVideo, mediaArchiveEnabled } from '@/lib/media-archive';
import { providerLinkLikelyDead } from '@/lib/media-state';
import type { VideoService } from '@/lib/video-service';
import type { VideoMetadata } from '@/types/video';
import * as React from 'react';

// 8 attempts with backoff capped at 5 min ≈ a 25-minute window — long
// clips and 4K clips can take several minutes of provider post-processing
// before the CDN link exists, and the old 15-minute window gave up on them.
const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 300_000;

interface ArchiveAttemptState {
    attempts: number;
    /** Epoch ms before which this id must not be retried. */
    nextAt: number;
}

interface UseMediaArchiveOptions {
    history: VideoMetadata[];
    /** Gate on the initial localStorage load so we don't archive against an empty list. */
    enabled: boolean;
    service: VideoService;
    resolveKey: () => Promise<string | null>;
    onArchived: (id: string, url: string, bytes: number | null) => void;
    onExpired?: (id: string) => void;
}

/**
 * Archive reconciliation.
 *
 * Doing this in the completion callback proved unreliable — that code runs
 * inside the polling closure, so whether it sees a key (or the CDN link, which
 * Ark attaches a beat after the job flips to completed) depends on render
 * timing. Reconciling from history instead is deterministic: any completed
 * video without a permanent URL gets one, retried until it sticks. It also
 * back-fills videos generated before archiving existed.
 *
 * Failures back off exponentially (30s, 1m, 2m, 4m) and give up after
 * MAX_ATTEMPTS for the rest of the session — the old version retried on every
 * history change, hammering the worker with items that can never archive
 * (e.g. provider link long expired). Runs one item at a time to avoid a burst
 * of large uploads.
 */
export function useMediaArchive({
    history,
    enabled,
    service,
    resolveKey,
    onArchived,
    onExpired
}: UseMediaArchiveOptions) {
    const attemptsRef = React.useRef<Map<string, ArchiveAttemptState>>(new Map());
    const busyRef = React.useRef(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    // Bumped after each attempt so the scheduling effect re-evaluates the queue.
    const [, setPass] = React.useState(0);

    const serviceRef = React.useRef(service);
    const resolveKeyRef = React.useRef(resolveKey);
    const onArchivedRef = React.useRef(onArchived);
    const onExpiredRef = React.useRef(onExpired);
    React.useEffect(() => {
        serviceRef.current = service;
        resolveKeyRef.current = resolveKey;
        onArchivedRef.current = onArchived;
        onExpiredRef.current = onExpired;
    }, [service, resolveKey, onArchived, onExpired]);

    const retryArchive = React.useCallback((id: string) => {
        attemptsRef.current.delete(id);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setPass((p) => p + 1);
    }, []);

    React.useEffect(() => {
        if (!enabled || busyRef.current) return;

        const now = Date.now();
        const candidates = history.filter((item) => {
            if (item.status !== 'completed' || item.storedUrl || item.mediaExpired) return false;
            const state = attemptsRef.current.get(item.id);
            return !state || state.attempts < MAX_ATTEMPTS;
        });
        if (candidates.length === 0) return;

        const due = candidates.find((item) => {
            const state = attemptsRef.current.get(item.id);
            return !state || state.nextAt <= now;
        });

        if (!due) {
            // Nothing due yet — wake up when the earliest backoff expires.
            const earliest = Math.min(
                ...candidates.map((item) => attemptsRef.current.get(item.id)?.nextAt ?? now)
            );
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setPass((p) => p + 1), Math.max(earliest - now, 1000));
            return;
        }

        busyRef.current = true;
        void (async () => {
            let success = false;
            let expired = false;
            try {
                if (!(await mediaArchiveEnabled())) {
                    // No worker configured: mark everything exhausted so this
                    // effect stops probing.
                    for (const item of candidates) {
                        attemptsRef.current.set(item.id, { attempts: MAX_ATTEMPTS, nextAt: Infinity });
                    }
                    return;
                }

                const key = await resolveKeyRef.current();
                if (!key) return; // Signed out — retry via backoff below.

                // Ark's link expires, so always read the job's current one.
                const job = await serviceRef.current.retrieveVideo(due.id);
                if (!job.output_url) {
                    expired = providerLinkLikelyDead(due, Date.now());
                    if (expired) {
                        attemptsRef.current.set(due.id, { attempts: MAX_ATTEMPTS, nextAt: Infinity });
                        onExpiredRef.current?.(due.id);
                    }
                    return;
                }

                const archived = await archiveVideo(due.id, job.output_url, key);
                if (!archived) return;

                success = true;
                attemptsRef.current.delete(due.id);
                onArchivedRef.current(due.id, archived.url, archived.bytes);
                console.log(`[media-archive] stored ${due.id} (${archived.bytes ?? '?'} bytes)`);
            } catch (err) {
                if (err instanceof ArchiveSourceFetchError && providerLinkLikelyDead(due, Date.now())) {
                    expired = true;
                    attemptsRef.current.set(due.id, { attempts: MAX_ATTEMPTS, nextAt: Infinity });
                    onExpiredRef.current?.(due.id);
                    console.warn(`[media-archive] ${due.id} expired before it could be archived.`);
                    return;
                }
                console.warn(`[media-archive] ${due.id} attempt failed:`, err);
            } finally {
                if (!success && !expired) {
                    const prev = attemptsRef.current.get(due.id);
                    const attempts = (prev?.attempts ?? 0) + 1;
                    attemptsRef.current.set(due.id, {
                        attempts,
                        nextAt: Date.now() + Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS)
                    });
                }
                busyRef.current = false;
                // Re-run the effect to pick up the next candidate (or schedule
                // the wake-up timer for backed-off ones).
                setPass((p) => p + 1);
            }
        })();
    });

    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return { retryArchive };
}
