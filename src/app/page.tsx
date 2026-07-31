'use client';

import { CreationForm, type CreationFormData } from '@/components/creation-form';
import { VideoHistoryPanel } from '@/components/video-history-panel';
import { VideoOutput } from '@/components/video-output';
import { ApiKeyDialog } from '@/components/api-key-dialog';
import { ApiKeyGate } from '@/components/api-key-gate';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { calculateVideoCost } from '@/lib/cost-utils';
import { db } from '@/lib/db';
import { VideoService } from '@/lib/video-service';
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
import { captureVideoPoster } from '@/lib/thumbnail';
import { XCITY_SSO_ENABLED, xcityLoginHref } from '@/lib/xcity-sso';
import { useMediaArchive } from '@/hooks/use-media-archive';
import { useVideoHistory } from '@/hooks/use-video-history';
import { useVideoJobs, readPersistedActiveJobIds } from '@/hooks/use-video-jobs';
import { useVideoSources } from '@/hooks/use-video-sources';
import { useXcityKey } from '@/hooks/use-xcity-key';
import * as React from 'react';
import type { VideoJob, VideoMetadata } from '@/types/video';

export default function HomePage() {
    const [error, setError] = React.useState<string | null>(null);
    const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = React.useState(false);
    const [currentJobId, setCurrentJobId] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Creation form state
    const [createModel, setCreateModel] = React.useState<VideoModel>(DEFAULT_MODEL);
    const [createPrompt, setCreatePrompt] = React.useState('');
    const [createRatio, setCreateRatio] = React.useState<VideoRatio>(DEFAULT_RATIO);
    const [createResolution, setCreateResolution] = React.useState<VideoResolution>(DEFAULT_RESOLUTION);
    const [createSeconds, setCreateSeconds] = React.useState<number>(DEFAULT_SECONDS);
    const [createAudio, setCreateAudio] = React.useState(true);
    const [createCameraFixed, setCreateCameraFixed] = React.useState(false);
    const [createInputReferenceUrl, setCreateInputReferenceUrl] = React.useState('');

    const { apiKey, keyRef, ssoStatus, ssoError, attemptSso, resolveKey, saveManualKey, invalidateKey } = useXcityKey();
    const { history, isInitialLoad, addItem, updateItem, removeItem, clearAll } = useVideoHistory();
    const { getVideoSrc, getThumbnailSrc, setRemoteSource, removeSource, clearAllSources, hasLocalCopy, hasSource } =
        useVideoSources();

    // One service for the app's lifetime: it reads the key through the ref at
    // call time, so it never needs rebuilding when the key arrives or rotates.
    const videoService = React.useMemo(() => {
        return new VideoService({
            getApiKey: () => keyRef.current,
            baseURL: process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleInvalidApiKey = React.useCallback(
        (message = 'Your Xcity API key was rejected. Please sign in again or enter a new key.') => {
            invalidateKey();
            setIsApiKeyDialogOpen(true);
            setError(message);
        },
        [invalidateKey]
    );

    /** Downloads a finished video into IndexedDB and finalizes its history entry. */
    const downloadAndStoreVideo = React.useCallback(
        async (job: VideoJob) => {
            console.log(`Downloading video for job: ${job.id}`);

            // Ark attaches the CDN link a moment after the job first reports
            // completed, so the update that triggered this can arrive without
            // one. Ask again rather than giving up on the video.
            let sourceUrl = job.output_url;
            if (!sourceUrl) {
                try {
                    sourceUrl = (await videoService.retrieveVideo(job.id)).output_url;
                } catch (err) {
                    console.warn(`Could not re-read output_url for ${job.id}:`, err);
                }
            }

            // Register the CDN link first so the video is watchable even if
            // the download below fails. Archiving to R2 is handled separately
            // by the reconciliation hook once history shows the completion.
            if (sourceUrl) {
                setRemoteSource(job.id, sourceUrl);
            }

            try {
                const blob = await videoService.downloadContent(job.id, sourceUrl);
                // The gateway serves only the raw MP4 — capture a poster frame
                // client-side for the history thumbnails.
                const thumbnailBlob = await captureVideoPoster(blob);

                await db.videos.put({
                    id: job.id,
                    filename: `${job.id}.mp4`,
                    blob,
                    thumbnail: thumbnailBlob,
                    created_at: job.created_at
                });

                updateItem(job.id, {
                    durationMs: Date.now() - job.created_at * 1000,
                    storageModeUsed: 'indexeddb',
                    status: 'completed'
                });
                console.log(`Video ${job.id} completed and stored`);
            } catch (err) {
                if (err instanceof InvalidApiKeyError) {
                    handleInvalidApiKey();
                    return;
                }
                console.error(`Error storing video ${job.id}:`, err);
                if (sourceUrl) {
                    // Playable from the CDN link — local storage is
                    // best-effort, so mark it done rather than failing it.
                    updateItem(job.id, {
                        durationMs: Date.now() - job.created_at * 1000,
                        status: 'completed'
                    });
                } else {
                    setError(err instanceof Error ? err.message : 'Failed to download video');
                }
            }
        },
        [videoService, setRemoteSource, updateItem, handleInvalidApiKey]
    );

    const jobCallbacks = React.useMemo(
        () => ({
            onProgress: (job: VideoJob) => {
                updateItem(job.id, { progress: job.progress, status: 'processing' });
            },
            onCompleted: (job: VideoJob) => {
                updateItem(job.id, { progress: 100, status: 'completed' });
                void downloadAndStoreVideo(job);
            },
            onFailed: (job: VideoJob) => {
                updateItem(job.id, {
                    status: 'failed',
                    error: job.error?.message || 'Video generation failed',
                    costDetails: null // No cost for failed videos
                });
                setError(job.error?.message || 'Video generation failed');
            },
            onInvalidKey: () => handleInvalidApiKey()
        }),
        [updateItem, downloadAndStoreVideo, handleInvalidApiKey]
    );

    const { activeJobs, addJob, replaceJob, removeJob, restoreJobs, clearJobs } = useVideoJobs(
        videoService,
        jobCallbacks
    );

    // Permanent R2 copies for completed videos (see hook for the why).
    useMediaArchive({
        history,
        enabled: !isInitialLoad,
        service: videoService,
        resolveKey,
        onArchived: (id, url) => {
            setRemoteSource(id, url);
            updateItem(id, { storedUrl: url });
        }
    });

    // Resume in-flight jobs after a page refresh.
    React.useEffect(() => {
        if (isInitialLoad || history.length === 0) return;

        const persistedIds = readPersistedActiveJobIds();
        const processingItems = history.filter(
            (item) => item.status === 'processing' && persistedIds.includes(item.id)
        );
        if (processingItems.length === 0) return;

        console.log(`Resuming ${processingItems.length} active job(s)`);
        restoreJobs(
            processingItems.map(
                (item): VideoJob => ({
                    id: item.id,
                    object: 'video',
                    created_at: item.timestamp / 1000,
                    status: 'in_progress', // Will be corrected by the first poll
                    model: item.model,
                    progress: item.progress || 0,
                    seconds: String(item.seconds),
                    size: item.size,
                    prompt: item.prompt,
                    remix_of: item.remix_of
                })
            )
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInitialLoad]);

    const handleCreateVideo = async (formData: CreationFormData) => {
        setError(null);
        setIsSubmitting(true);

        // Resolve the key at submit time — an SSO key that lands after this
        // handler's render is invisible to its closure, and keys rotate.
        const activeKey = await resolveKey();
        if (!activeKey) {
            setError('Could not read your Xcity API key. Sign in at xcity.ai and retry.');
            setIsSubmitting(false);
            return;
        }

        // Optimistic placeholder so the output panel reacts immediately.
        const displaySize = formatSize(formData.ratio, formData.resolution);
        const tempId = `temp_${Date.now()}`;
        addJob({
            id: tempId,
            object: 'video',
            created_at: Date.now() / 1000,
            status: 'queued',
            model: formData.model,
            progress: 0,
            seconds: String(formData.seconds),
            size: displaySize,
            prompt: formData.prompt
        });
        setCurrentJobId(tempId);

        try {
            const result = await videoService.createVideo(formData);
            console.log('Video job created:', result.id);

            // Normalize gateway-shaped fields (size "16x9", seconds "5") to
            // the display values the form produced.
            const job: VideoJob = {
                ...result,
                prompt: formData.prompt,
                size: displaySize,
                seconds: String(formData.seconds)
            };

            replaceJob(tempId, job);
            setCurrentJobId(job.id);

            addItem({
                id: job.id,
                timestamp: Date.now(),
                filename: `${job.id}.mp4`,
                storageModeUsed: 'indexeddb',
                durationMs: 0, // Set when complete
                model: job.model,
                size: job.size,
                seconds: formData.seconds,
                prompt: formData.prompt,
                mode: 'create',
                costDetails: calculateVideoCost({
                    model: formData.model,
                    resolution: formData.resolution,
                    seconds: formData.seconds
                }),
                status: 'processing',
                progress: 0
            });
        } catch (err: unknown) {
            console.error('Error creating video:', err);
            if (err instanceof InvalidApiKeyError) {
                handleInvalidApiKey();
            } else {
                setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
            }
            removeJob(tempId);
            setCurrentJobId(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleHistorySelect = (item: VideoMetadata) => {
        setCurrentJobId(item.id);

        // If the job is still active it's already tracked.
        if (activeJobs.has(item.id)) {
            return;
        }

        // Register a display job for the output panel.
        addJob({
            id: item.id,
            object: 'video',
            created_at: item.timestamp,
            status: item.status === 'failed' ? 'failed' : 'completed',
            model: item.model,
            progress: item.status === 'failed' ? item.progress || 0 : 100,
            seconds: String(item.seconds),
            size: item.size,
            prompt: item.prompt,
            ...(item.error && { error: { message: item.error } }),
            ...(item.remix_of && { remix_of: item.remix_of })
        });

        // Resolve a playback source on demand. A permanent R2 copy beats
        // everything: it never expires and is CORS-enabled.
        if (item.storedUrl && !hasSource(item.id)) {
            setRemoteSource(item.id, item.storedUrl);
            return;
        }

        // Otherwise ask the gateway for the job's current output_url — signed
        // Ark links last 24h, so whatever the poll cached may have expired.
        if (item.status !== 'failed' && !hasSource(item.id) && !hasLocalCopy(item.id)) {
            void (async () => {
                try {
                    const fresh = await videoService.retrieveVideo(item.id);
                    if (fresh.output_url) {
                        setRemoteSource(item.id, fresh.output_url);
                    }
                } catch (err) {
                    console.warn(`Could not resolve a source for ${item.id}:`, err);
                }
            })();
        }
    };

    const handleClearHistory = async () => {
        const confirmed = window.confirm(
            'Clear the entire video history? This deletes the videos stored in your browser. Archived cloud copies and your Xcity billing history are not affected. This cannot be undone.'
        );
        if (!confirmed) return;

        clearAll();
        clearJobs();
        setCurrentJobId(null);
        setError(null);

        try {
            await db.videos.clear();
            clearAllSources();
        } catch (e) {
            console.error('Failed during history clearing:', e);
            setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const handleDeleteVideo = async (item: VideoMetadata) => {
        console.log(`Deleting video: ${item.id}`);
        setError(null);

        try {
            await db.videos.where('id').equals(item.id).delete();
            removeSource(item.id);
            removeItem(item.id);
            removeJob(item.id);
            if (currentJobId === item.id) {
                setCurrentJobId(null);
            }
        } catch (err) {
            console.error('Error deleting video:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete video');
        }
    };

    const handleDownloadVideo = async (videoId: string) => {
        try {
            const url = getVideoSrc(videoId);
            if (!url) {
                throw new Error('Video source not found');
            }
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

    const handleSaveApiKey = async (rawKey: string) => {
        await saveManualKey(rawKey);
        setError(null);
    };

    const currentJob = currentJobId ? activeJobs.get(currentJobId) : null;
    const currentVideoSrc = currentJobId ? getVideoSrc(currentJobId) : null;
    const currentThumbnailSrc = currentJobId ? getThumbnailSrc(currentJobId) : null;

    // Without SSO the manual key is the only way in — gate until one is set.
    const isApiKeyGateBlocked = !XCITY_SSO_ENABLED && !apiKey;

    return (
        <main className='flex flex-col items-center bg-black p-4 text-white md:p-8 lg:p-12'>
            <ApiKeyDialog isOpen={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen} onSave={handleSaveApiKey} />

            <div className='w-full max-w-7xl space-y-6'>
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch'>
                    <div className='relative flex min-h-[600px] flex-col lg:col-span-1'>
                        <ApiKeyGate
                            isBlocked={isApiKeyGateBlocked}
                            onConfigure={() => setIsApiKeyDialogOpen(true)}
                            className='flex-1'>
                            {XCITY_SSO_ENABLED && ssoStatus !== 'ok' ? (
                                <div className='flex h-full min-h-[600px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-white/10 bg-black p-8 text-center'>
                                    {ssoStatus === 'checking' ? (
                                        <>
                                            <p className='text-lg font-medium text-white'>
                                                Connecting your Xcity account…
                                            </p>
                                            <p className='text-sm text-white/50'>
                                                Fetching your TokenHub key from xcity.ai
                                            </p>
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
                                                    onClick={() => void attemptSso()}
                                                    className='bg-white/10 text-white hover:bg-white/20'>
                                                    Retry
                                                </Button>
                                                <Button
                                                    variant='ghost'
                                                    onClick={() => setIsApiKeyDialogOpen(true)}
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
                                    cameraFixed={createCameraFixed}
                                    setCameraFixed={setCreateCameraFixed}
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
                            isLoading={
                                currentJob ? currentJob.status === 'queued' || currentJob.status === 'in_progress' : false
                            }
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
