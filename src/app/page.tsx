'use client';

import { GallerySection } from '@/components/gallery/gallery-section';
import { CreationForm, type CreationFormData } from '@/components/creation-form';
import { VideoHistoryPanel } from '@/components/video-history-panel';
import { VideoOutput } from '@/components/video-output';
import { ApiKeyDialog } from '@/components/api-key-dialog';
import { ApiKeyGate } from '@/components/api-key-gate';
import { ImageStudio } from '@/components/image-studio';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateVideoCost } from '@/lib/cost-utils';
import { db, type ImageRecord } from '@/lib/db';
import {
    IMAGE_GENERATION_ENABLED,
    generateImages,
    type GeneratedImage,
    type ImageSizeId
} from '@/lib/image-service';
import { VideoService } from '@/lib/video-service';
import { InvalidApiKeyError } from '@/lib/errors';
import {
    DEFAULT_MODEL,
    DEFAULT_RATIO,
    DEFAULT_RESOLUTION,
    DEFAULT_SECONDS,
    clampSeconds,
    formatSize,
    getSeedanceModel,
    maxReferenceImages,
    parseSize,
    type VideoModel,
    type VideoRatio,
    type VideoResolution
} from '@/lib/seedance';
import {
    deleteUserAsset,
    listUserAssets,
    mediaArchiveEnabled,
    uploadReferenceImage
} from '@/lib/media-archive';
import { AssetsPanel } from '@/components/assets-panel';
import { optimizePrompt } from '@/lib/prompt-optimizer';
import { estimateVideoProgress } from '@/lib/progress';
import { reconcilePreset } from '@/lib/gallery-preset';
import type { GalleryItem } from '@/lib/gallery';
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
    const [activeTab, setActiveTab] = React.useState<'video' | 'image' | 'assets'>('video');

    // Creation form state
    const [createModel, setCreateModel] = React.useState<VideoModel>(DEFAULT_MODEL);
    const [createPrompt, setCreatePrompt] = React.useState('');
    const [createRatio, setCreateRatio] = React.useState<VideoRatio>(DEFAULT_RATIO);
    const [createResolution, setCreateResolution] = React.useState<VideoResolution>(DEFAULT_RESOLUTION);
    const [createSeconds, setCreateSeconds] = React.useState<number>(DEFAULT_SECONDS);
    const [createAudio, setCreateAudio] = React.useState(true);
    const [createCameraFixed, setCreateCameraFixed] = React.useState(false);
    const [createReferenceUrls, setCreateReferenceUrls] = React.useState<string[]>([]);

    const { apiKey, keyRef, ssoStatus, ssoError, attemptSso, resolveKey, saveManualKey, invalidateKey } = useXcityKey();
    const { history, isInitialLoad, addItem, updateItem, removeItem, clearAll } = useVideoHistory();
    const { getVideoSrc, getThumbnailSrc, setRemoteSource, removeSource, clearAllSources, hasLocalCopy, hasSource } =
        useVideoSources();

    // Showcase → creation form. Settings are reconciled against the target
    // model first (see gallery-preset), because programmatic setState skips
    // the form's own Select-driven correction.
    const creationFormRef = React.useRef<HTMLDivElement>(null);

    const applyPreset = React.useCallback((item: GalleryItem) => {
        const p = reconcilePreset(item.params);
        setCreateModel(p.model);
        setCreatePrompt(p.prompt);
        setCreateRatio(p.ratio);
        setCreateResolution(p.resolution);
        setCreateSeconds(p.seconds);
        setCreateAudio(p.generate_audio);
        setCreateReferenceUrls(p.input_reference_url ? [p.input_reference_url] : []);
        setError(p.adjusted.length ? `Adjusted for ${p.model}: ${p.adjusted.join(', ')}` : null);
        creationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const applyReferenceFrame = React.useCallback((item: GalleryItem, frameUrl: string) => {
        setCreateModel(item.params.model);
        setCreateRatio(item.params.ratio);
        setCreateReferenceUrls([frameUrl]);
        // Leave the prompt to the user: describing the motion is the point of
        // image-to-video, and inheriting the original prompt fights that.
        setCreatePrompt('');
        creationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    // One service for the app's lifetime: it reads the key through the ref at
    // call time, so it never needs rebuilding when the key arrives or rotates.
    const videoService = React.useMemo(() => {
        return new VideoService({
            getApiKey: () => keyRef.current,
            baseURL: process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Local image upload is only offered when a media worker is configured
    // (checked at runtime via /api/config).
    const [uploadEnabled, setUploadEnabled] = React.useState(false);
    React.useEffect(() => {
        void mediaArchiveEnabled().then(setUploadEnabled);
    }, []);

    const handleUploadImage = React.useCallback(
        async (file: File): Promise<string> => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) before uploading images.');
            }
            return uploadReferenceImage(file, key);
        },
        [resolveKey]
    );

    const handleGenerateImages = React.useCallback(
        async (params: { prompt: string; model: string; size: ImageSizeId; n: number }): Promise<GeneratedImage[]> => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) to generate images.');
            }
            return generateImages(params, key, process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL);
        },
        [resolveKey]
    );

    /** 发送到图生视频 — resolve a public URL for the image and load it into the video form. */
    const handleAnimateImage = React.useCallback(
        async (record: ImageRecord) => {
            let url: string | null = null;

            // A worker-hosted copy is permanent and CORS-clean — prefer it.
            if (record.blob && (await mediaArchiveEnabled())) {
                const key = await resolveKey();
                if (!key) {
                    throw new Error('Sign in at xcity.ai (or set an API key) first.');
                }
                const file = new File([record.blob], `${record.id}.png`, {
                    type: record.blob.type || 'image/png'
                });
                url = await uploadReferenceImage(file, key);
            } else if (record.source_url) {
                // Provider URL: works while it lasts; the gateway fetches it
                // server-side so CORS is not a concern.
                url = record.source_url;
            }

            if (!url) {
                throw new Error(
                    'This image has no public URL and no media worker is configured to host one. Download it and upload it in the video form instead.'
                );
            }

            setCreateReferenceUrls([url]);
            setActiveTab('video');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [resolveKey]
    );

    const handleLoadAssets = React.useCallback(async () => {
        const key = await resolveKey();
        if (!key) {
            throw new Error('Sign in at xcity.ai (or set an API key) to view your assets.');
        }
        return listUserAssets(key);
    }, [resolveKey]);

    const handleDeleteAsset = React.useCallback(
        async (assetKey: string) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) first.');
            }
            await deleteUserAsset(assetKey, key);
        },
        [resolveKey]
    );

    /** Assets tab → video form: append the image to the reference list. */
    const handleUseAssetAsReference = React.useCallback(
        (url: string) => {
            setCreateReferenceUrls((prev) =>
                prev.includes(url) ? prev : [...prev, url].slice(0, maxReferenceImages(createModel))
            );
            setActiveTab('video');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [createModel]
    );

    const handleOptimizePrompt = React.useCallback(
        async (prompt: string): Promise<string> => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) to use AI optimization.');
            }
            return optimizePrompt(prompt, key, process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL);
        },
        [resolveKey]
    );

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

            // Ark attaches the CDN link a beat AFTER the job first reports
            // completed — a single immediate re-read usually comes back empty
            // and the preview then hangs forever. Poll with backoff (~1 min
            // window) until the link shows up.
            let sourceUrl = job.output_url;
            const retryDelaysMs = [2_000, 4_000, 8_000, 16_000, 30_000];
            for (const delay of retryDelaysMs) {
                if (sourceUrl) break;
                await new Promise((resolve) => setTimeout(resolve, delay));
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
                    setError(
                        `The gateway reported the video as completed but never exposed its download link (job ${job.id}). ` +
                            'Select it from History in a moment to retry, or check the TokenHub logs.'
                    );
                }
            }
        },
        [videoService, setRemoteSource, updateItem, handleInvalidApiKey]
    );

    const jobCallbacks = React.useMemo(
        () => ({
            onProgress: (job: VideoJob) => {
                // The gateway rarely reports a real percentage — blend it with
                // a time-based estimate so history tiles show movement.
                updateItem(job.id, {
                    progress: estimateVideoProgress(job.created_at, Number(job.seconds), job.progress, Date.now()),
                    status: 'processing'
                });
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
                createParams: formData,
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
                handleInvalidApiKey(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
            }
            removeJob(tempId);
            setCurrentJobId(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Rebuilds submission parameters from a history item — the stored
     * createParams when present, otherwise best-effort from display fields
     * (items predating the field).
     */
    const buildParamsFromItem = React.useCallback((item: VideoMetadata): CreationFormData => {
        if (item.createParams) {
            return { ...item.createParams, prompt: item.prompt };
        }
        const parsed = parseSize(item.size);
        const model = getSeedanceModel(item.model) ? (item.model as VideoModel) : DEFAULT_MODEL;
        return {
            model,
            prompt: item.prompt,
            ratio: parsed?.ratio ?? DEFAULT_RATIO,
            resolution: parsed?.resolution ?? DEFAULT_RESOLUTION,
            seconds: clampSeconds(item.seconds, model),
            generate_audio: true,
            camera_fixed: false
        };
    }, []);

    /** 做同款 — fill the create form with an item's parameters. */
    const handleReuseItem = React.useCallback(
        (item: VideoMetadata) => {
            const params = buildParamsFromItem(item);
            setCreateModel(params.model);
            setCreatePrompt(params.prompt);
            setCreateRatio(params.ratio);
            setCreateResolution(params.resolution);
            setCreateSeconds(params.seconds);
            setCreateAudio(params.generate_audio);
            setCreateCameraFixed(params.camera_fixed ?? false);
            setCreateReferenceUrls(
                params.reference_image_urls ?? (params.input_reference_url ? [params.input_reference_url] : [])
            );
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [buildParamsFromItem]
    );

    /** 重新生成 — resubmit an item with its exact parameters. */
    const handleRegenerateItem = (item: VideoMetadata) => {
        void handleCreateVideo(buildParamsFromItem(item));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleHistorySelect = (item: VideoMetadata) => {
        setCurrentJobId(item.id);

        // An in-flight job is already tracked and has no source yet. Terminal
        // jobs fall through: they may still need a playback source resolved
        // (e.g. the CDN link arrived late or expired).
        const tracked = activeJobs.get(item.id);
        if (tracked && tracked.status !== 'completed' && tracked.status !== 'failed') {
            return;
        }

        // Register a display job for the output panel.
        if (!tracked) addJob({
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

    const videoTabContent = (
        <>
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch'>
                    <div ref={creationFormRef} className='relative flex min-h-[600px] flex-col lg:col-span-1'>
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
                                    referenceUrls={createReferenceUrls}
                                    setReferenceUrls={setCreateReferenceUrls}
                                    onUploadImage={uploadEnabled ? handleUploadImage : undefined}
                                    onOptimizePrompt={handleOptimizePrompt}
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

                <GallerySection onUsePreset={applyPreset} onUseAsReference={applyReferenceFrame} />

                <div className='min-h-[450px]'>
                    <VideoHistoryPanel
                        history={history}
                        activeJobs={activeJobs}
                        onSelectVideo={handleHistorySelect}
                        onClearHistory={handleClearHistory}
                        getVideoSrc={getVideoSrc}
                        getThumbnailSrc={getThumbnailSrc}
                        onDeleteItem={handleDeleteVideo}
                        onReuseItem={handleReuseItem}
                        onRegenerateItem={handleRegenerateItem}
                    />
                </div>
        </>
    );

    return (
        <main className='flex flex-col items-center bg-black p-4 text-white md:p-8 lg:p-12'>
            <ApiKeyDialog isOpen={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen} onSave={handleSaveApiKey} />

            <div className='w-full max-w-7xl space-y-6'>
                {IMAGE_GENERATION_ENABLED || uploadEnabled ? (
                    <Tabs
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as 'video' | 'image' | 'assets')}>
                        <TabsList className='mb-4 border border-white/10 bg-white/5'>
                            <TabsTrigger
                                value='video'
                                className='px-6 text-white/60 data-[state=active]:bg-white data-[state=active]:text-black'>
                                Video
                            </TabsTrigger>
                            {IMAGE_GENERATION_ENABLED && (
                                <TabsTrigger
                                    value='image'
                                    className='px-6 text-white/60 data-[state=active]:bg-white data-[state=active]:text-black'>
                                    Image
                                </TabsTrigger>
                            )}
                            {uploadEnabled && (
                                <TabsTrigger
                                    value='assets'
                                    className='px-6 text-white/60 data-[state=active]:bg-white data-[state=active]:text-black'>
                                    Assets
                                </TabsTrigger>
                            )}
                        </TabsList>
                        <TabsContent value='video' className='space-y-6'>
                            {videoTabContent}
                        </TabsContent>
                        {IMAGE_GENERATION_ENABLED && (
                            <TabsContent value='image'>
                                <ImageStudio onGenerate={handleGenerateImages} onAnimate={handleAnimateImage} />
                            </TabsContent>
                        )}
                        {uploadEnabled && (
                            <TabsContent value='assets'>
                                <div className='min-h-[450px]'>
                                    <AssetsPanel
                                        loadAssets={handleLoadAssets}
                                        deleteAsset={handleDeleteAsset}
                                        onUseAsReference={handleUseAssetAsReference}
                                        active={activeTab === 'assets'}
                                    />
                                </div>
                            </TabsContent>
                        )}
                    </Tabs>
                ) : (
                    <div className='space-y-6'>{videoTabContent}</div>
                )}
            </div>
        </main>
    );
}
