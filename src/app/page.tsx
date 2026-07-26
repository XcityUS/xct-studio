'use client';

import { CreationForm, type CreationFormData } from '@/components/creation-form';
import { VideoHistoryPanel } from '@/components/video-history-panel';
import { VideoOutput } from '@/components/video-output';
import { PasswordDialog } from '@/components/password-dialog';
import { ApiKeyDialog } from '@/components/api-key-dialog';
import { ApiKeyGate } from '@/components/api-key-gate';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { calculateVideoCost } from '@/lib/cost-utils';
import { db, type VideoRecord } from '@/lib/db';
import { VideoService, type ApiMode } from '@/lib/video-service';
import { verifyFrontendApiKey } from '@/lib/openai-client';
import { InvalidApiKeyError } from '@/lib/errors';
import {
    DEFAULT_MODEL,
    DEFAULT_RATIO,
    DEFAULT_RESOLUTION,
    DEFAULT_SECONDS,
    formatSize,
    type VideoModel,
    type VideoRatio,
    type VideoResolution
} from '@/lib/seedance';
import { archiveVideo } from '@/lib/media-archive';
import { captureVideoPoster } from '@/lib/thumbnail';
import { XCITY_SSO_ENABLED, fetchXcityUserKey, getLastKnownKey, rememberKey, xcityLoginHref } from '@/lib/xcity-sso';
import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';
import type { VideoJob, VideoMetadata } from '@/types/video';

const explicitModeClient = process.env.NEXT_PUBLIC_FILE_STORAGE_MODE;
const vercelEnvClient = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isOnVercelClient = vercelEnvClient === 'production' || vercelEnvClient === 'preview';

// Frontend mode detection
const isFrontendModeEnabled = process.env.NEXT_PUBLIC_ENABLE_FRONTEND_MODE === 'true';

const initialApiMode: ApiMode = isFrontendModeEnabled ? 'frontend' : 'backend';
const getStoredApiKey = (): string | null => {
    if (typeof window === 'undefined' || !isFrontendModeEnabled) {
        return null;
    }
    return localStorage.getItem('openaiApiKey');
};

let effectiveStorageModeClient: 'fs' | 'indexeddb';

// Frontend mode always uses indexeddb (no backend filesystem available)
if (isFrontendModeEnabled) {
    effectiveStorageModeClient = 'indexeddb';
    console.log('Frontend mode enabled - forcing indexeddb storage');
} else if (isOnVercelClient && explicitModeClient === 'fs') {
    // Prevent fs mode on Vercel (filesystem is read-only/ephemeral)
    console.warn('fs mode is not supported on Vercel, forcing indexeddb mode');
    effectiveStorageModeClient = 'indexeddb';
} else if (explicitModeClient === 'fs') {
    effectiveStorageModeClient = 'fs';
} else if (explicitModeClient === 'indexeddb') {
    effectiveStorageModeClient = 'indexeddb';
} else if (isOnVercelClient) {
    effectiveStorageModeClient = 'indexeddb';
} else {
    effectiveStorageModeClient = 'fs';
}

console.log(
    `Client Effective Storage Mode: ${effectiveStorageModeClient} (Explicit: ${explicitModeClient || 'unset'}, Vercel Env: ${vercelEnvClient || 'N/A'}, Frontend Mode: ${isFrontendModeEnabled})`
);

export default function HomePage() {
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(
        isFrontendModeEnabled ? false : null
    );
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
    const [forceDeleteDialogOpen, setForceDeleteDialogOpen] = React.useState(false);
    const [itemToForceDelete, setItemToForceDelete] = React.useState<VideoMetadata | null>(null);

    // Frontend mode state
    const [apiMode, setApiMode] = React.useState<ApiMode>(initialApiMode);
    const [clientApiKey, setClientApiKey] = React.useState<string | null>(() => getStoredApiKey());
    const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = React.useState(false);

    // Xcity unified-key SSO: pull the signed-in user's TokenHub key from
    // xcity.ai and switch to direct-gateway (frontend) calls on their own
    // plan/budget. See lib/xcity-sso.ts.
    const [ssoStatus, setSsoStatus] = React.useState<'checking' | 'ok' | 'unauthenticated' | 'error'>(
        XCITY_SSO_ENABLED ? 'checking' : 'ok'
    );
    const [ssoError, setSsoError] = React.useState<string | null>(null);

    const attemptXcitySso = React.useCallback(async () => {
        setSsoStatus('checking');
        setSsoError(null);
        const result = await fetchXcityUserKey();
        if (result.status === 'ok') {
            rememberKey(result.key);
            setClientApiKey(result.key);
            setApiMode('frontend');
            setSsoStatus('ok');
            return;
        }
        setSsoStatus(result.status === 'unauthenticated' ? 'unauthenticated' : 'error');
        if (result.status === 'error') {
            setSsoError(result.message);
        }
    }, []);

    React.useEffect(() => {
        if (XCITY_SSO_ENABLED) {
            void attemptXitySsoSafe();
        }
        async function attemptXitySsoSafe() {
            try {
                await attemptXcitySso();
            } catch {
                setSsoStatus('error');
            }
        }
    }, [attemptXcitySso]);

    // Job tracking
    const [activeJobs, setActiveJobs] = React.useState<Map<string, VideoJob>>(new Map());
    const activeJobsRef = React.useRef(activeJobs);
    const [pollingInterval, setPollingInterval] = React.useState<NodeJS.Timeout | null>(null);
    const [currentJobId, setCurrentJobId] = React.useState<string | null>(null);
    const [videoSrcCache, setVideoSrcCache] = React.useState<Map<string, string>>(new Map());
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Keep ref in sync with state
    React.useEffect(() => {
        activeJobsRef.current = activeJobs;
    }, [activeJobs]);

    // Memoize a stable key for active job IDs to trigger polling effect
    const activeJobIdsKey = React.useMemo(() => {
        const ids = Array.from(activeJobs.keys()).filter(id => !id.startsWith('temp_'));
        return ids.join('|');
    }, [activeJobs]);

    // Helper to save active job IDs to localStorage
    const saveActiveJobIds = React.useCallback((jobs: Map<string, VideoJob>) => {
        const activeIds = Array.from(jobs.keys()).filter(id => !id.startsWith('temp_'));
        localStorage.setItem('activeVideoJobs', JSON.stringify(activeIds));
    }, []);

    // History
    const [history, setHistory] = React.useState<VideoMetadata[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);

    // Creation form state
    const [createModel, setCreateModel] = React.useState<VideoModel>(DEFAULT_MODEL);
    const [createPrompt, setCreatePrompt] = React.useState('');
    const [createRatio, setCreateRatio] = React.useState<VideoRatio>(DEFAULT_RATIO);
    const [createResolution, setCreateResolution] = React.useState<VideoResolution>(DEFAULT_RESOLUTION);
    const [createSeconds, setCreateSeconds] = React.useState<number>(DEFAULT_SECONDS);
    const [createAudio, setCreateAudio] = React.useState(true);
    const [createInputReferenceUrl, setCreateInputReferenceUrl] = React.useState('');

    const allDbVideos = useLiveQuery<VideoRecord[] | undefined>(() => db.videos.toArray(), []);

    // Load history from localStorage
    React.useEffect(() => {
        try {
            const storedHistory = localStorage.getItem('soraVideoHistory');
            if (storedHistory) {
                const parsedHistory: VideoMetadata[] = JSON.parse(storedHistory);
                if (Array.isArray(parsedHistory)) {
                    setHistory(parsedHistory);
                } else {
                    console.warn('Invalid history data found in localStorage.');
                    localStorage.removeItem('soraVideoHistory');
                }
            }
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem('soraVideoHistory');
        }
        setIsInitialLoad(false);
    }, []);

    // Save history to localStorage
    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem('soraVideoHistory', JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [history, isInitialLoad]);

    // Check password requirement and validate stored hash
    React.useEffect(() => {
        if (isFrontendModeEnabled) {
            setIsPasswordRequiredByBackend(false);
            setClientPasswordHash(null);
            if (typeof window !== 'undefined') {
                localStorage.removeItem('clientPasswordHash');
            }
            return;
        }

        const fetchAuthStatus = async () => {
            try {
                // Check if we have a stored password hash
                const storedHash = localStorage.getItem('clientPasswordHash');

                // Call auth-status with stored hash (if exists) for validation
                const response = await fetch('/api/auth-status', {
                    headers: storedHash ? { 'x-password-hash': storedHash } : {}
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch auth status');
                }

                const data = await response.json();
                const passwordRequired = data.passwordRequired;
                const isValid = data.valid;

                setIsPasswordRequiredByBackend(passwordRequired);

                // Handle different scenarios
                if (!passwordRequired) {
                    // No password required, clear any stored hash
                    if (storedHash) {
                        localStorage.removeItem('clientPasswordHash');
                        setClientPasswordHash(null);
                    }
                } else if (storedHash && isValid === false) {
                    // Stored hash is invalid (password changed on server)
                    console.log('Stored password hash is invalid, clearing and prompting for new password');
                    localStorage.removeItem('clientPasswordHash');
                    setClientPasswordHash(null);
                    setPasswordDialogContext('retry');
                    setIsPasswordDialogOpen(true);
                } else if (storedHash && isValid === true) {
                    // Stored hash is valid
                    setClientPasswordHash(storedHash);
                } else if (!storedHash && passwordRequired) {
                    // Password is required but not set - show dialog immediately
                    console.log('Password required but not set, showing dialog');
                    setPasswordDialogContext('initial');
                    setIsPasswordDialogOpen(true);
                }
            } catch (error) {
                console.error('Error fetching auth status:', error);
                setIsPasswordRequiredByBackend(false);
            }
        };

        fetchAuthStatus();
    }, []);

    // Refresh content when password becomes available
    React.useEffect(() => {
        if (clientPasswordHash && isPasswordRequiredByBackend) {
            console.log('Password authenticated - content fetching is now enabled');
            // The guards in getVideoSrc and getThumbnailSrc will now allow API calls
            // Components will automatically re-render and fetch content since the callbacks depend on clientPasswordHash
        }
    }, [clientPasswordHash, isPasswordRequiredByBackend]);

    // Initialize frontend mode and API key
    React.useEffect(() => {
        if (!isFrontendModeEnabled) {
            return;
        }
        if (apiMode !== 'frontend') {
            setApiMode('frontend');
        }
        if (clientApiKey !== null) {
            return;
        }
        const storedApiKey = getStoredApiKey();
        if (storedApiKey) {
            setClientApiKey(storedApiKey);
        }
    }, [apiMode, clientApiKey]);

    React.useEffect(() => {
        if (isFrontendModeEnabled) {
            console.log('Frontend mode enabled');
        }
    }, []);

    // Create VideoService instance
    const videoService = React.useMemo(() => {
        return new VideoService({
            mode: apiMode,
            clientApiKey,
            clientPasswordHash,
            baseURL: process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL
        });
    }, [apiMode, clientApiKey, clientPasswordHash]);

    // Cleanup polling interval on unmount
    React.useEffect(() => {
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, [pollingInterval]);

    async function sha256Client(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    const handleSavePassword = async (password: string) => {
        if (!password.trim()) {
            setError('Password cannot be empty.');
            return;
        }
        try {
            const hash = await sha256Client(password);
            localStorage.setItem('clientPasswordHash', hash);
            setClientPasswordHash(hash);
            setError(null);
            setIsPasswordDialogOpen(false);
        } catch (e) {
            console.error('Error hashing password:', e);
            setError('Failed to save password due to a hashing error.');
        }
    };

    const handleSaveApiKey = async (apiKey: string) => {
        const trimmedKey = apiKey.trim();

        if (!trimmedKey) {
            throw new Error('API key cannot be empty.');
        }

        if (!trimmedKey.startsWith('sk-')) {
            throw new Error('API key format looks incorrect. It should start with “sk-”.');
        }

        try {
            await verifyFrontendApiKey(trimmedKey, process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL);
        } catch (error) {
            if (error instanceof InvalidApiKeyError) {
                throw new Error('OpenAI rejected this API key. Please double-check and try again.');
            }
            console.error('Error verifying API key:', error);
            throw new Error('Failed to verify API key. Please try again.');
        }

        try {
            localStorage.setItem('openaiApiKey', trimmedKey);
        } catch (storageError) {
            console.error('Error saving API key:', storageError);
            throw new Error('Failed to persist API key. Please ensure storage is available.');
        }

        rememberKey(trimmedKey);
        setClientApiKey(trimmedKey);
        // A user-supplied TokenHub key always talks to the gateway directly.
        setApiMode('frontend');
        setSsoStatus('ok');
        setError(null);
    };

    const handleOpenApiKeyDialog = () => {
        setIsApiKeyDialogOpen(true);
    };

    const handleInvalidApiKey = React.useCallback(
        (message = 'Your OpenAI API key was rejected. Please enter a new key.') => {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('openaiApiKey');
            }
            setClientApiKey(null);
            setIsApiKeyDialogOpen(true);
            setError(message);
        },
        [setClientApiKey, setError, setIsApiKeyDialogOpen]
    );

    const getVideoSrc = React.useCallback(
        (id: string): string | undefined => {
            // Don't return video source for failed or processing videos
            const historyItem = history.find(h => h.id === id);
            if (historyItem?.status === 'failed' || historyItem?.status === 'processing') {
                return undefined;
            }

            // Check cache first
            if (videoSrcCache.has(id)) {
                return videoSrcCache.get(id);
            }

            // Check IndexedDB (always used in frontend mode and indexeddb storage mode)
            const record = allDbVideos?.find((vid) => vid.id === id);
            if (record?.blob) {
                const url = URL.createObjectURL(record.blob);
                // Don't set state during render - cache will be set when video is downloaded
                return url;
            }

            // Frontend mode only uses IndexedDB - if not found, video hasn't been downloaded yet
            if (apiMode === 'frontend') {
                return undefined;
            }

            // Backend mode: use API endpoints
            // Don't attempt API call if we haven't determined password requirement yet
            if (isPasswordRequiredByBackend === null) {
                return undefined;
            }

            // Don't attempt API call if password is required but not provided
            if (isPasswordRequiredByBackend && !clientPasswordHash) {
                return undefined;
            }

            // Fallback to filesystem API with password hash as query param
            const url = `/api/videos/${id}/content`;
            if (clientPasswordHash) {
                return `${url}?password-hash=${encodeURIComponent(clientPasswordHash)}`;
            }
            return url;
        },
        [allDbVideos, videoSrcCache, history, isPasswordRequiredByBackend, clientPasswordHash, apiMode]
    );

    const getThumbnailSrc = React.useCallback(
        (id: string): string | undefined => {
            // Don't return thumbnail for failed or processing videos
            const historyItem = history.find(h => h.id === id);
            if (historyItem?.status === 'failed' || historyItem?.status === 'processing') {
                return undefined;
            }

            // Check IndexedDB (always used in frontend mode and indexeddb storage mode)
            const record = allDbVideos?.find((vid) => vid.id === id);
            if (record?.thumbnail) {
                return URL.createObjectURL(record.thumbnail);
            }

            // Thumbnails are captured client-side from the downloaded blob and
            // stored in IndexedDB — the TokenHub gateway has no thumbnail
            // variant. Not found = poster not captured (yet).
            return undefined;
        },
        [allDbVideos, history]
    );

    // Single polling interval for all active jobs
    React.useEffect(() => {
        // Get non-temp active jobs that are still processing
        const realJobs = Array.from(activeJobs.entries()).filter(
            ([id, job]) => !id.startsWith('temp_') && job.status !== 'completed' && job.status !== 'failed'
        );

        const hasActiveJobs = realJobs.length > 0;

        // Stop polling if no active jobs
        if (!hasActiveJobs) {
            if (pollingInterval) {
                console.log('No active jobs, stopping polling');
                clearInterval(pollingInterval);
                setPollingInterval(null);
            }
            return;
        }

        // Start polling if we don't have an interval yet
        if (!pollingInterval && hasActiveJobs) {
            console.log(`Starting polling for ${realJobs.length} active job(s)`);

            // Define the polling function
            const pollAllJobs = async () => {
                // Get current real jobs from ref (always latest) that are still processing
                const currentRealJobs = Array.from(activeJobsRef.current.entries()).filter(
                    ([id, job]) => !id.startsWith('temp_') && job.status !== 'completed' && job.status !== 'failed'
                );

                if (currentRealJobs.length === 0) {
                    console.log('No jobs to poll');
                    return;
                }

                // Poll each job sequentially
                for (const [jobId, job] of currentRealJobs) {
                    try {
                        const jobUpdate: VideoJob = await videoService.retrieveVideo(jobId);
                        console.log(`Job ${jobId} status: ${jobUpdate.status}, progress: ${jobUpdate.progress}`);

                            // Update active jobs
                            setActiveJobs(prev => {
                                const existingJob = prev.get(jobId);
                                if (!existingJob) return prev;

                                const updatedJob = {
                                    ...jobUpdate,
                                    prompt: existingJob.prompt || jobUpdate.prompt,
                                    remix_of: existingJob.remix_of || jobUpdate.remix_of
                                };

                                const newJobs = new Map(prev);
                                newJobs.set(jobId, updatedJob);
                                return newJobs;
                            });

                            // Update history item with progress
                            setHistory(prev =>
                                prev.map(item => {
                                    if (item.id === jobId) {
                                        return {
                                            ...item,
                                            progress: jobUpdate.progress,
                                            status: jobUpdate.status === 'completed' ? 'completed' :
                                                   jobUpdate.status === 'failed' ? 'failed' : 'processing'
                                        };
                                    }
                                    return item;
                                })
                            );

                            if (jobUpdate.status === 'completed') {
                                // Remove from active jobs FIRST to prevent duplicate downloads
                                setActiveJobs(prev => {
                                    const newJobs = new Map(prev);
                                    newJobs.delete(jobId);
                                    saveActiveJobIds(newJobs);
                                    return newJobs;
                                });

                                // Download and store video (async, won't block next poll)
                                downloadAndStoreVideo({
                                    ...jobUpdate,
                                    prompt: job.prompt || jobUpdate.prompt,
                                    remix_of: job.remix_of || jobUpdate.remix_of
                                }).catch(err => {
                                    if (err instanceof InvalidApiKeyError) {
                                        handleInvalidApiKey();
                                        return;
                                    }
                                    console.error(`Error downloading completed video ${jobId}:`, err);
                                    setError(err instanceof Error ? err.message : 'Failed to download video');
                                });
                            } else if (jobUpdate.status === 'failed') {
                                // Update history with error and remove cost
                                setHistory(prev =>
                                    prev.map(item => {
                                        if (item.id === jobId) {
                                            return {
                                                ...item,
                                                status: 'failed',
                                                error: jobUpdate.error?.message || 'Video generation failed',
                                                costDetails: null // No cost for failed videos
                                            };
                                        }
                                        return item;
                                    })
                                );
                                // Remove from active jobs
                                setActiveJobs(prev => {
                                    const newJobs = new Map(prev);
                                    newJobs.delete(jobId);
                                    saveActiveJobIds(newJobs);
                                    return newJobs;
                                });
                                setError(jobUpdate.error?.message || 'Video generation failed');
                            }
                    } catch (err) {
                        if (err instanceof InvalidApiKeyError) {
                            handleInvalidApiKey();
                            setActiveJobs(new Map());
                            saveActiveJobIds(new Map());
                            return;
                        }
                        console.error(`Error polling job ${jobId}:`, err);
                        // Don't stop polling other jobs if one fails
                    }
                }
            };

            // Poll immediately on start
            pollAllJobs();

            // Then continue polling every 10 seconds
            const interval = setInterval(pollAllJobs, 10000);

            setPollingInterval(interval);
        }

        // Cleanup when effect re-runs or component unmounts
        // Note: Only clear if we're about to create a new one or unmounting
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeJobIdsKey, clientPasswordHash, clientApiKey, apiMode]);

    // Resume active jobs on initial load
    React.useEffect(() => {
        if (!isInitialLoad && history.length > 0) {
            // Check for active jobs and resume them
            const activeJobIds = JSON.parse(localStorage.getItem('activeVideoJobs') || '[]');
            const processingJobs = history.filter(
                item => item.status === 'processing' && activeJobIds.includes(item.id)
            );

            if (processingJobs.length > 0) {
                console.log(`Found ${processingJobs.length} active jobs to resume`);

                const restoredJobs = new Map<string, VideoJob>();

                processingJobs.forEach(item => {
                    console.log(`Resuming job: ${item.id}`);

                    // Recreate the job in activeJobs
                    const restoredJob: VideoJob = {
                        id: item.id,
                        object: 'video',
                        created_at: item.timestamp / 1000, // Convert to seconds
                        status: 'in_progress', // Will be updated by polling
                        model: item.model,
                        progress: item.progress || 0,
                        seconds: String(item.seconds),
                        size: item.size,
                        prompt: item.prompt,
                        remix_of: item.remix_of
                    };

                    restoredJobs.set(item.id, restoredJob);
                });

                // Set all restored jobs at once
                setActiveJobs(restoredJobs);

                console.log('Restored jobs will be picked up by the polling interval');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInitialLoad]);

    const downloadAndStoreVideo = async (job: VideoJob) => {
        console.log(`Downloading video for job: ${job.id}`);

        // Ark attaches the CDN link a moment after the job first reports
        // completed, so the status update that triggered this can arrive
        // without one. Ask again rather than giving up on the video.
        let sourceUrl = job.output_url;
        if (!sourceUrl) {
            try {
                sourceUrl = (await videoService.retrieveVideo(job.id)).output_url;
            } catch (err) {
                console.warn(`Could not re-read output_url for ${job.id}:`, err);
            }
        }

        // Prefer the provider's CDN link: playback starts immediately and no
        // bytes are proxied through the gateway. Registered before anything
        // else so the video is watchable even if the steps below fail.
        if (sourceUrl) {
            setVideoSrcCache((prev) => new Map(prev).set(job.id, sourceUrl as string));
        }

        // Copy into our own bucket. The provider link expires in 24h, so this
        // is what makes the video still playable tomorrow. Best-effort: on
        // failure we simply keep the provider URL.
        const archiveKey = clientApiKey ?? getLastKnownKey();
        if (sourceUrl && archiveKey) {
            const archived = await archiveVideo(job.id, sourceUrl, archiveKey);
            if (archived) {
                setVideoSrcCache((prev) => new Map(prev).set(job.id, archived.url));
                setHistory((prev) =>
                    prev.map((item) => (item.id === job.id ? { ...item, storedUrl: archived.url } : item))
                );
            }
        }

        try {
            // Archive a local copy so history survives the CDN link expiring.
            const blob = await videoService.downloadContent(job.id, job.output_url);
            const filename = `${job.id}.mp4`;

            // The gateway serves only the raw MP4 — capture a poster frame
            // client-side for the history thumbnails.
            const thumbnailBlob = await captureVideoPoster(blob);

            // Store in IndexedDB if needed
            if (effectiveStorageModeClient === 'indexeddb') {
                await db.videos.put({
                    id: job.id,
                    filename,
                    blob,
                    thumbnail: thumbnailBlob,
                    created_at: job.created_at
                });
                console.log(`Saved video ${job.id} with thumbnail to IndexedDB`);

                // Create blob URL for immediate display
                const blobUrl = URL.createObjectURL(blob);
                setVideoSrcCache((prev) => new Map(prev).set(job.id, blobUrl));
            }

            // Calculate total duration from job creation to completion (created_at is Unix timestamp in seconds)
            const durationMs = Date.now() - job.created_at * 1000;

            // Update the existing history entry with completion data
            setHistory((prev) => {
                return prev.map((item) => {
                    if (item.id === job.id) {
                        // Update existing entry with completion data
                        return {
                            ...item,
                            durationMs,
                            storageModeUsed: effectiveStorageModeClient,
                            status: 'completed' as const
                        };
                    }
                    return item;
                });
            });
            console.log(`Video ${job.id} completed and history updated`);
        } catch (err) {
            if (err instanceof InvalidApiKeyError) {
                handleInvalidApiKey();
                return;
            }
            console.error(`Error archiving video ${job.id}:`, err);
            if (job.output_url) {
                // Playable from the CDN link — archiving is best-effort, so
                // mark it done rather than showing the user a failure.
                setHistory((prev) =>
                    prev.map((item) =>
                        item.id === job.id
                            ? {
                                  ...item,
                                  durationMs: Date.now() - job.created_at * 1000,
                                  status: 'completed' as const
                              }
                            : item
                    )
                );
            } else {
                setError(err instanceof Error ? err.message : 'Failed to download video');
            }
        }
    };

    const handleCreateVideo = async (formData: CreationFormData) => {
        setError(null);
        setIsSubmitting(true);

        // Backend mode: check password
        if (apiMode === 'backend' && isPasswordRequiredByBackend && !clientPasswordHash) {
            setError('Password is required. Please configure the password by clicking the lock icon.');
            setPasswordDialogContext('initial');
            setIsPasswordDialogOpen(true);
            setIsSubmitting(false);
            return;
        }

        // Resolve the key at submit time rather than trusting the render this
        // handler was bound in: an SSO key that lands after the form rendered
        // is invisible to that closure, and SSO keys rotate. Falls back to the
        // module-level copy, then to a fresh fetch.
        let activeKey = clientApiKey ?? getLastKnownKey();
        if (apiMode === 'frontend' && !activeKey && XCITY_SSO_ENABLED) {
            const refreshed = await fetchXcityUserKey();
            if (refreshed.status === 'ok') {
                activeKey = refreshed.key;
                setClientApiKey(refreshed.key);
            }
        }
        if (apiMode === 'frontend' && !activeKey) {
            setError('Could not read your Xcity API key. Sign in at xcity.ai and retry.');
            setSsoStatus('unauthenticated');
            setIsSubmitting(false);
            return;
        }
        const submitService =
            apiMode === 'frontend' && activeKey !== clientApiKey
                ? new VideoService({
                      mode: apiMode,
                      clientApiKey: activeKey,
                      clientPasswordHash,
                      baseURL: process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL
                  })
                : videoService;

        // Create a temporary job to show immediate feedback
        const displaySize = formatSize(formData.ratio, formData.resolution);
        const tempId = `temp_${Date.now()}`;
        const tempJob: VideoJob = {
            id: tempId,
            object: 'video',
            created_at: Date.now() / 1000,
            status: 'queued',
            model: formData.model,
            progress: 0,
            seconds: String(formData.seconds),
            size: displaySize,
            prompt: formData.prompt
        };

        // Show temporary job immediately
        setActiveJobs((prev) => new Map(prev).set(tempId, tempJob));
        setCurrentJobId(tempId);

        try {
            console.log('Creating video job...');

            const result = await submitService.createVideo(formData);

            console.log('Video job created:', result);

            // Normalize gateway-shaped fields (size "16x9", seconds "5") to
            // the display values the form produced.
            const job: VideoJob = {
                ...result,
                prompt: formData.prompt,
                size: displaySize,
                seconds: String(formData.seconds)
            };

            // Remove temporary job and add real job
            setActiveJobs((prev) => {
                const newJobs = new Map(prev);
                newJobs.delete(tempId);
                newJobs.set(job.id, job);
                return newJobs;
            });

            setCurrentJobId(job.id);

            // Calculate cost immediately
            const costDetails = calculateVideoCost({
                model: formData.model,
                resolution: formData.resolution,
                seconds: formData.seconds
            });

            // Add to history immediately with queued status
            const newHistoryEntry: VideoMetadata = {
                id: job.id,
                timestamp: Date.now(),
                filename: `${job.id}.mp4`,
                storageModeUsed: effectiveStorageModeClient,
                durationMs: 0, // Will be updated when complete
                model: job.model,
                size: job.size,
                seconds: formData.seconds,
                prompt: formData.prompt,
                mode: 'create',
                costDetails,
                status: 'processing',
                progress: 0
            };

            setHistory((prev) => [newHistoryEntry, ...prev]);

            // Save active job IDs
            setActiveJobs((prev) => {
                const newJobs = new Map(prev).set(job.id, job);
                saveActiveJobIds(newJobs);
                return newJobs;
            });
            console.log(`Video ${job.id} added to history with queued status`);

            setIsSubmitting(false);
        } catch (err: unknown) {
            console.error('Error creating video:', err);
            if (err instanceof InvalidApiKeyError) {
                handleInvalidApiKey('The provided OpenAI API key was rejected. Please enter a valid key.');
            } else {
                const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
                setError(errorMessage);
            }

            // Remove temporary job on error
            setActiveJobs((prev) => {
                const newJobs = new Map(prev);
                newJobs.delete(tempId);
                return newJobs;
            });
            setCurrentJobId(null);
            setIsSubmitting(false);
        }
    };

    const handleHistorySelect = (item: VideoMetadata) => {
        console.log(`Selecting video from history: ${item.id}`);
        setCurrentJobId(item.id);

        // If job is still active, it's already tracked
        if (activeJobs.has(item.id)) {
            return;
        }

        // Create a job entry for display based on the item's actual status
        const jobForDisplay: VideoJob = {
            id: item.id,
            object: 'video',
            created_at: item.timestamp,
            status: item.status === 'failed' ? 'failed' : 'completed',
            model: item.model,
            progress: item.status === 'failed' ? (item.progress || 0) : 100,
            seconds: String(item.seconds),
            size: item.size,
            prompt: item.prompt,
            ...(item.error && { error: { message: item.error } }),
            ...(item.remix_of && { remix_of: item.remix_of })
        };

        setActiveJobs((prev) => new Map(prev).set(item.id, jobForDisplay));

        // Resolve a playback source on demand. A locally archived blob wins;
        // otherwise ask the gateway for the job's current output_url. Doing
        // this per selection (rather than trusting whatever the poll cached)
        // also handles the CDN link expiring — signed Ark URLs last 24h.
        // A permanent copy beats everything: it never expires and is CORS-enabled.
        if (item.storedUrl && !videoSrcCache.has(item.id)) {
            setVideoSrcCache((prev) => new Map(prev).set(item.id, item.storedUrl as string));
            return;
        }

        if (item.status !== 'failed' && !videoSrcCache.has(item.id) && !allDbVideos?.some((v) => v.id === item.id)) {
            void (async () => {
                try {
                    const fresh = await videoService.retrieveVideo(item.id);
                    if (fresh.output_url) {
                        setVideoSrcCache((prev) => new Map(prev).set(item.id, fresh.output_url as string));
                    }
                } catch (err) {
                    console.warn(`Could not resolve a source for ${item.id}:`, err);
                }
            })();
        }
    };

    const handleClearHistory = async () => {
        const confirmationMessage =
            effectiveStorageModeClient === 'indexeddb'
                ? 'Are you sure you want to clear the entire video history? This will delete all stored videos from your browser (IndexedDB) but will NOT delete them from OpenAI servers. This cannot be undone.'
                : 'Are you sure you want to clear the entire video history? This only clears your local history and does NOT delete videos from OpenAI servers. This cannot be undone.';

        if (window.confirm(confirmationMessage)) {
            setHistory([]);
            setCurrentJobId(null);
            setActiveJobs(new Map());
            setError(null);

            try {
                localStorage.removeItem('soraVideoHistory');
                console.log('Cleared history metadata from localStorage.');

                if (effectiveStorageModeClient === 'indexeddb') {
                    await db.videos.clear();
                    console.log('Cleared videos from IndexedDB.');
                    setVideoSrcCache(new Map());
                }
            } catch (e) {
                console.error('Failed during history clearing:', e);
                setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    };

    const handleDeleteVideo = async (item: VideoMetadata, forceLocal = false) => {
        console.log(`Deleting video: ${item.id}${forceLocal ? ' (force local only)' : ''}`);
        setError(null);

        try {
            // Only delete from storage/OpenAI if video was actually created (not failed) and not force local
            if (item.status !== 'failed' && !forceLocal) {
                if (effectiveStorageModeClient === 'indexeddb') {
                    await db.videos.where('id').equals(item.id).delete();
                    setVideoSrcCache((prev) => {
                        const next = new Map(prev);
                        next.delete(item.id);
                        return next;
                    });
                    console.log('Deleted video from IndexedDB');
                } else {
                    // Delete from OpenAI via service (handles both backend and frontend modes)
                    try {
                        await videoService.deleteVideo(item.id);
                        console.log('Deleted video from OpenAI');
                    } catch (err: unknown) {
                        if (err instanceof InvalidApiKeyError) {
                            handleInvalidApiKey();
                            return;
                        }
                        // Handle "still processing" error with force delete option
                        if (err instanceof Error && err.message?.includes('still being processed')) {
                            setItemToForceDelete(item);
                            setForceDeleteDialogOpen(true);
                            return;
                        }
                        throw err;
                    }
                }
            } else {
                console.log(`Skipping storage/OpenAI deletion for ${item.status === 'failed' ? 'failed' : 'force local'} video ${item.id}`);
            }

            // Remove from history
            setHistory((prev) => prev.filter((v) => v.id !== item.id));

            // Clear if it's the current video
            if (currentJobId === item.id) {
                setCurrentJobId(null);
                setActiveJobs((prev) => {
                    const next = new Map(prev);
                    next.delete(item.id);
                    saveActiveJobIds(next);
                    return next;
                });
            }
        } catch (err) {
            if (err instanceof InvalidApiKeyError) {
                handleInvalidApiKey();
                return;
            }
            console.error('Error deleting video:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete video');
        }
    };

    const handleForceDeleteConfirm = () => {
        if (itemToForceDelete) {
            handleDeleteVideo(itemToForceDelete, true);
        }
        setForceDeleteDialogOpen(false);
        setItemToForceDelete(null);
    };

    const handleForceDeleteCancel = () => {
        setForceDeleteDialogOpen(false);
        setItemToForceDelete(null);
    };

    const handleDownloadVideo = async (videoId: string) => {
        console.log(`Downloading video: ${videoId}`);
        try {
            const url = getVideoSrc(videoId);
            if (!url) {
                throw new Error('Video source not found');
            }

            // Create a download link
            const a = document.createElement('a');
            a.href = url;
            a.download = `${videoId}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            console.error('Error downloading video:', err);
            setError(err instanceof Error ? err.message : 'Failed to download video');
        }
    };

    const currentJob = currentJobId ? activeJobs.get(currentJobId) : null;
    const currentVideoSrc = currentJobId ? getVideoSrc(currentJobId) : null;
    const currentThumbnailSrc = currentJobId ? getThumbnailSrc(currentJobId) : null;

    // Determine if API key gate should block
    const isApiKeyGateBlocked = isFrontendModeEnabled && apiMode === 'frontend' && !clientApiKey;

    return (
        <main className='flex min-h-screen flex-col items-center bg-black p-4 text-white md:p-8 lg:p-12'>
            {!isFrontendModeEnabled && (
                <PasswordDialog
                    isOpen={isPasswordDialogOpen}
                    onOpenChange={setIsPasswordDialogOpen}
                    onSave={handleSavePassword}
                    isRequired={isPasswordRequiredByBackend === true && !clientPasswordHash}
                    title={passwordDialogContext === 'retry' ? 'Invalid Password' : 'Password Required'}
                    description={
                        passwordDialogContext === 'retry'
                            ? 'The password was incorrect. Please try again.'
                            : 'This application is password-protected. Please enter the password to continue.'
                    }
                />
            )}

            <ApiKeyDialog
                isOpen={isApiKeyDialogOpen}
                onOpenChange={setIsApiKeyDialogOpen}
                onSave={handleSaveApiKey}
            />

            <Dialog open={forceDeleteDialogOpen} onOpenChange={setForceDeleteDialogOpen}>
                <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                    <DialogHeader>
                        <DialogTitle className='flex items-center gap-2 text-white'>
                            <AlertCircle className='h-5 w-5 text-yellow-500' />
                            Video Still Processing
                        </DialogTitle>
                        <DialogDescription className='text-neutral-400'>
                            This video is still processing on OpenAI servers and cannot be deleted remotely yet.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='py-4 text-sm text-neutral-300'>
                        <p>Would you like to force delete it from your local history?</p>
                        <p className='mt-3 text-xs text-neutral-400'>
                            ⚠️ This will remove it from your view, but it may still exist on OpenAI servers.
                        </p>
                    </div>
                    <DialogFooter className='gap-2'>
                        <Button
                            type='button'
                            variant='secondary'
                            onClick={handleForceDeleteCancel}
                            className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                            Wait
                        </Button>
                        <Button
                            type='button'
                            onClick={handleForceDeleteConfirm}
                            className='bg-red-600 text-white hover:bg-red-700'>
                            Force Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className='w-full max-w-7xl space-y-6'>
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch'>
                    <div className='relative flex min-h-[600px] flex-col lg:col-span-1'>
                        <ApiKeyGate
                            isBlocked={isApiKeyGateBlocked}
                            onConfigure={handleOpenApiKeyDialog}
                            className='flex-1'>
                            {XCITY_SSO_ENABLED && ssoStatus !== 'ok' ? (
                                <div className='flex h-full min-h-[600px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-white/10 bg-black p-8 text-center'>
                                    {ssoStatus === 'checking' ? (
                                        <>
                                            <p className='text-lg font-medium text-white'>Connecting your Xcity account…</p>
                                            <p className='text-sm text-white/50'>Fetching your TokenHub key from xcity.ai</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className='text-lg font-medium text-white'>Sign in with Xcity</p>
                                            <p className='max-w-sm text-sm text-white/60'>
                                                Video generation runs on your own Xcity plan. Sign in at xcity.ai and
                                                come back — your TokenHub key is picked up automatically.
                                            </p>
                                            {ssoStatus === 'error' && ssoError && (
                                                <p className='max-w-sm text-xs text-red-300/80'>({ssoError})</p>
                                            )}
                                            <div className='flex flex-wrap items-center justify-center gap-3'>
                                                <Button asChild className='bg-white text-black hover:bg-white/90'>
                                                    <a href={xcityLoginHref()}>Sign in at xcity.ai</a>
                                                </Button>
                                                <Button
                                                    variant='secondary'
                                                    onClick={() => void attemptXcitySso()}
                                                    className='bg-white/10 text-white hover:bg-white/20'>
                                                    Retry
                                                </Button>
                                                <Button
                                                    variant='ghost'
                                                    onClick={handleOpenApiKeyDialog}
                                                    className='text-white/60 hover:bg-white/10 hover:text-white'>
                                                    Use an API key instead
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                            <CreationForm
                                onSubmit={handleCreateVideo}
                                isLoading={isSubmitting}
                                model={createModel}
                                setModel={setCreateModel}
                                prompt={createPrompt}
                                setPrompt={setCreatePrompt}
                                ratio={createRatio}
                                setRatio={setCreateRatio}
                                resolution={createResolution}
                                setResolution={setCreateResolution}
                                seconds={createSeconds}
                                setSeconds={setCreateSeconds}
                                generateAudio={createAudio}
                                setGenerateAudio={setCreateAudio}
                                inputReferenceUrl={createInputReferenceUrl}
                                setInputReferenceUrl={setCreateInputReferenceUrl}
                            />
                            )}
                        </ApiKeyGate>
                    </div>
                    <div className='flex min-h-[600px] flex-col lg:col-span-1'>
                        {error && (
                            <Alert variant='destructive' className='mb-4 border-red-500/50 bg-red-900/20 text-red-300'>
                                <AlertTitle className='text-red-200'>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <VideoOutput
                            job={currentJob || null}
                            videoSrc={currentVideoSrc}
                            thumbnailSrc={currentThumbnailSrc}
                            isLoading={currentJob ? currentJob.status === 'queued' || currentJob.status === 'in_progress' : false}
                            onDownload={handleDownloadVideo}
                        />
                    </div>
                </div>

                <div className='min-h-[450px]'>
                    <VideoHistoryPanel
                        history={history}
                        activeJobs={activeJobs}
                        onSelectVideo={handleHistorySelect}
                        onClearHistory={handleClearHistory}
                        getVideoSrc={getVideoSrc}
                        getThumbnailSrc={getThumbnailSrc}
                        onDeleteItem={handleDeleteVideo}
                    />
                </div>
            </div>
        </main>
    );
}
