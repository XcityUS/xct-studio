'use client';

import { ApiKeyDialog } from '@/components/api-key-dialog';
import { ApiKeyGate } from '@/components/api-key-gate';
import { AssetsPanel } from '@/components/assets-panel';
import { CommunityPanel } from '@/components/community-panel';
import { CreationForm, type CreationFormData } from '@/components/creation-form';
import { GallerySection } from '@/components/gallery/gallery-section';
import { ImageStudio } from '@/components/image-studio';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VideoHistoryPanel } from '@/components/video-history-panel';
import { VideoOutput } from '@/components/video-output';
import { useMediaArchive } from '@/hooks/use-media-archive';
import { usePosterBackfill } from '@/hooks/use-poster-backfill';
import { useVideoHistory } from '@/hooks/use-video-history';
import { useVideoJobs } from '@/hooks/use-video-jobs';
import { useVideoSources } from '@/hooks/use-video-sources';
import { useXcityKey } from '@/hooks/use-xcity-key';
import { transcribeVideo, type CaptionSegment } from '@/lib/captions';
import { calculateVideoCost } from '@/lib/cost-utils';
import { db, type ImageRecord } from '@/lib/db';
import { InvalidApiKeyError, RealPersonImageError } from '@/lib/errors';
import type { GalleryItem } from '@/lib/gallery';
import { reconcilePreset } from '@/lib/gallery-preset';
import {
    generateImages,
    loadImageModels,
    type GeneratedImage,
    type ImageModel,
    type ImageSizeId
} from '@/lib/image-service';
import {
    audioUrlToDataUri,
    createShare,
    deleteUserAsset,
    fetchCommunityList,
    fetchCommunityQueue,
    fetchShare,
    imageUrlToDataUri,
    listUserAssets,
    mediaArchiveEnabled,
    mediaWorkerUrl,
    portraitEnabled as loadPortraitEnabled,
    publishToCommunity,
    reviewCommunityItem,
    transcribeModel,
    ttsModel,
    type CommunityReviewAction,
    type UserAsset,
    uploadReferenceAudio,
    uploadReferenceImage,
    uploadReferenceVideo,
    videoUrlToDataUri
} from '@/lib/media-archive';
import { providerLinkLikelyDead } from '@/lib/media-state';
import {
    createPortraitGroup,
    createPortraitAsset,
    createPortraitSession,
    fetchPortraitStatus,
    getPortraitAsset,
    listPortraitGroups,
    type PortraitGroupQueryType
} from '@/lib/portrait';
import { estimateVideoProgress } from '@/lib/progress';
import { optimizePrompt } from '@/lib/prompt-optimizer';
import {
    ASSET_LIBRARY_MODEL_BLOCK_REASON,
    declarationBlockReason,
    declarationSatisfied,
    isAssetReferenceUrl,
    originForGeneratedImage,
    refKey,
    referenceRequiresAssetLibrary,
    type ReferenceDeclaration,
    type ReferenceOrigin
} from '@/lib/reference-origin';
import { breakdownScript } from '@/lib/script-breakdown';
import {
    DEFAULT_MODEL,
    DEFAULT_RATIO,
    DEFAULT_RESOLUTION,
    DEFAULT_SECONDS,
    RATIOS,
    RESOLUTIONS,
    clampSeconds,
    formatSize,
    getSeedanceModel,
    maxReferenceImages,
    modelSupportsResolution,
    parseSize,
    type VideoModel,
    type VideoRatio,
    type VideoResolution
} from '@/lib/seedance';
import { captureVideoLastFrame, captureVideoPoster } from '@/lib/thumbnail';
import { synthesizeSpeech, type TtsVoice } from '@/lib/tts';
import { VideoService } from '@/lib/video-service';
import { XCITY_SSO_ENABLED, xcityLoginHref } from '@/lib/xcity-sso';
import type { VideoJob, VideoJobCreate, VideoMetadata } from '@/types/video';
import { Check, Copy, Loader2 } from 'lucide-react';
import * as React from 'react';

function fileNameWithoutExtension(fileName: string): string {
    const clean = fileName.trim();
    const dot = clean.lastIndexOf('.');
    return dot > 0 ? clean.slice(0, dot) : clean;
}

function voiceoverAssetName(text: string): string {
    const firstWords = text.trim().replace(/\s+/g, ' ').split(' ').slice(0, 5).join(' ');
    const safeWords = firstWords
        .replace(/[\/\\?%*:|"<>]/g, '')
        .slice(0, 60)
        .trim();
    return safeWords ? `voiceover-${safeWords}` : 'voiceover';
}

const MAX_REFERENCE_VIDEOS = 2;
type StudioTab = 'video' | 'image' | 'assets' | 'community';

/** Where a message belongs, so it lands next to the control that raised it. */
type ErrorScope = 'create' | 'output';

function isVideoResolution(value: string | undefined): value is VideoResolution {
    return Boolean(value && RESOLUTIONS.includes(value as VideoResolution));
}

function isVideoRatio(value: string | undefined): value is VideoRatio {
    return Boolean(value && RATIOS.includes(value as VideoRatio));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isVideoJobCreateParams(value: unknown): value is VideoJobCreate {
    if (!isRecord(value)) return false;
    return (
        typeof value.prompt === 'string' &&
        typeof value.model === 'string' &&
        Boolean(getSeedanceModel(value.model)) &&
        typeof value.ratio === 'string' &&
        isVideoRatio(value.ratio) &&
        typeof value.resolution === 'string' &&
        isVideoResolution(value.resolution) &&
        typeof value.seconds === 'number' &&
        typeof value.generate_audio === 'boolean'
    );
}

function shareTitleFromPrompt(prompt: string): string {
    const title = prompt.trim().replace(/\s+/g, ' ');
    if (!title) return 'Xcity Studio video';
    return title.length > 120 ? `${title.slice(0, 117)}...` : title;
}

function shareParamsToForm(prompt: string, params: unknown): { params: CreationFormData; adjusted: string[] } {
    if (isVideoJobCreateParams(params)) {
        const reconciled = reconcilePreset({ ...params, prompt });
        return { params: reconciled, adjusted: reconciled.adjusted };
    }

    const record = isRecord(params) ? params : {};
    const model =
        typeof record.model === 'string' && getSeedanceModel(record.model)
            ? (record.model as VideoModel)
            : DEFAULT_MODEL;
    const ratio = typeof record.ratio === 'string' && isVideoRatio(record.ratio) ? record.ratio : DEFAULT_RATIO;
    const requestedResolution =
        typeof record.resolution === 'string' && isVideoResolution(record.resolution)
            ? record.resolution
            : DEFAULT_RESOLUTION;
    const resolution = modelSupportsResolution(model, requestedResolution) ? requestedResolution : DEFAULT_RESOLUTION;
    const rawSeconds =
        typeof record.seconds === 'number'
            ? record.seconds
            : typeof record.seconds === 'string'
              ? Number(record.seconds)
              : DEFAULT_SECONDS;
    const seconds = clampSeconds(rawSeconds, model);
    const seed = typeof record.seed === 'number' && Number.isFinite(record.seed) ? Math.trunc(record.seed) : undefined;
    const adjusted = [
        resolution !== requestedResolution ? `resolution → ${resolution}` : '',
        seconds !== rawSeconds ? `duration → ${seconds}s` : ''
    ].filter(Boolean);

    return {
        params: {
            model,
            prompt,
            ratio,
            resolution,
            seconds,
            generate_audio: typeof record.generate_audio === 'boolean' ? record.generate_audio : true,
            camera_fixed: typeof record.camera_fixed === 'boolean' ? record.camera_fixed : false,
            seed,
            watermark: typeof record.watermark === 'boolean' ? record.watermark : false
        },
        adjusted
    };
}

function bestSupportedResolution(model: VideoModel): VideoResolution {
    return (
        [...RESOLUTIONS].reverse().find((resolution) => modelSupportsResolution(model, resolution)) ??
        DEFAULT_RESOLUTION
    );
}

function finalResolutionForDraft(model: VideoModel, resolution: string | undefined): VideoResolution {
    return isVideoResolution(resolution) && modelSupportsResolution(model, resolution)
        ? resolution
        : bestSupportedResolution(model);
}

function inputVideoSecondsFromParams(params: VideoJobCreate): number {
    if (!params.reference_video_urls?.length || !params.reference_video_seconds?.length) return 0;
    return params.reference_video_seconds
        .slice(0, params.reference_video_urls.length)
        .reduce((total, seconds) => (Number.isFinite(seconds) && seconds > 0 ? total + seconds : total), 0);
}

function portraitReferenceUrl(assetId: string): string {
    return `asset://${assetId}`;
}

function imageReferenceUrlsFromParams(params: VideoJobCreate): string[] {
    const refs = params.reference_image_urls ?? (params.input_reference_url ? [params.input_reference_url] : []);
    const lastFrame = params.last_frame_url?.trim();
    return [...refs, ...(lastFrame ? [lastFrame] : [])].map((url) => url.trim()).filter(Boolean);
}

function withPortraitDeclarations(
    declarations: Record<string, ReferenceDeclaration>,
    portraits: { assetId: string; groupId: string; groupType: 'LivenessFace' | 'AIGC' }[]
): Record<string, ReferenceDeclaration> {
    const next = { ...declarations };
    for (const portrait of portraits) {
        const assetId = portrait.assetId.trim();
        const groupId = portrait.groupId.trim();
        if (!assetId || !groupId) continue;

        const key = refKey(portraitReferenceUrl(assetId));
        if (!key) continue;
        const existing = next[key];
        next[key] = {
            ...(existing ?? {}),
            origin: portrait.groupType === 'AIGC' ? 'thirdparty-ai' : 'real-person',
            declaredAt: existing?.declaredAt ?? 0,
            assetId,
            groupId
        };
    }
    return next;
}

export default function HomePage() {
    // Errors are shown next to whatever raised them: 'create' renders under
    // the Create Video button, 'output' under the output panel's action row.
    // A single alert at the top of the right column meant every failed click
    // sent the user scrolling back up to find out why.
    const [errorState, setErrorState] = React.useState<{ message: string; scope: ErrorScope } | null>(null);
    const setError = React.useCallback((message: string | null, scope: ErrorScope = 'create') => {
        setErrorState(message ? { message, scope } : null);
    }, []);
    const createError = errorState?.scope === 'create' ? errorState.message : null;
    const outputError = errorState?.scope === 'output' ? errorState.message : null;

    // Completed videos the gateway has no playable link for. State, not a ref:
    // the output panel renders a retry instead of spinning "loading preview…"
    // forever, which is what it did whenever a probe came back empty.
    const [unresolvedPreviewIds, setUnresolvedPreviewIds] = React.useState<Set<string>>(new Set());
    const unresolvedPreviewIdsRef = React.useRef(unresolvedPreviewIds);
    unresolvedPreviewIdsRef.current = unresolvedPreviewIds;
    const markPreviewUnresolved = React.useCallback((id: string, unresolved: boolean) => {
        setUnresolvedPreviewIds((prev) => {
            if (prev.has(id) === unresolved) return prev;
            const next = new Set(prev);
            if (unresolved) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);
    const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = React.useState(false);
    const [currentJobId, setCurrentJobId] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<StudioTab>('video');
    const [shareNotice, setShareNotice] = React.useState<string | null>(null);
    const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
    const [shareDialogId, setShareDialogId] = React.useState('');
    const [shareDialogUrl, setShareDialogUrl] = React.useState('');
    const [shareDialogError, setShareDialogError] = React.useState<string | null>(null);
    const [sharingVideoId, setSharingVideoId] = React.useState<string | null>(null);
    const [shareUrlCopied, setShareUrlCopied] = React.useState(false);
    const [shareCommunityStatus, setShareCommunityStatus] = React.useState<'idle' | 'submitting' | 'submitted'>('idle');
    const [shareCommunityError, setShareCommunityError] = React.useState<string | null>(null);

    // Creation form state
    const [createModel, setCreateModel] = React.useState<VideoModel>(DEFAULT_MODEL);
    const [createPrompt, setCreatePrompt] = React.useState('');
    const [createRatio, setCreateRatio] = React.useState<VideoRatio>(DEFAULT_RATIO);
    const [createResolution, setCreateResolution] = React.useState<VideoResolution>(DEFAULT_RESOLUTION);
    const [createSeconds, setCreateSeconds] = React.useState<number>(DEFAULT_SECONDS);
    const [createAudio, setCreateAudio] = React.useState(true);
    const [createCameraFixed, setCreateCameraFixed] = React.useState(false);
    const [createReferenceUrls, setCreateReferenceUrls] = React.useState<string[]>([]);
    const [createLastFrameUrl, setCreateLastFrameUrl] = React.useState('');
    const [createReferenceAudioUrl, setCreateReferenceAudioUrl] = React.useState('');
    const [createReferenceVideoUrls, setCreateReferenceVideoUrls] = React.useState<string[]>([]);
    const [createSeed, setCreateSeed] = React.useState<number | undefined>(undefined);
    const [createWatermark, setCreateWatermark] = React.useState(false);

    const { apiKey, keyRef, ssoStatus, ssoError, attemptSso, resolveKey, saveManualKey, invalidateKey } = useXcityKey();
    const {
        history,
        characters,
        portraits,
        declarations,
        isInitialLoad,
        addItem,
        updateItem,
        removeItem,
        clearAll,
        addCharacter,
        removeCharacter,
        addPortrait,
        removePortrait,
        setDeclaration
    } = useVideoHistory(resolveKey);
    const { getVideoSrc, getThumbnailSrc, setRemoteSource, removeSource, clearAllSources, hasLocalCopy, hasSource } =
        useVideoSources();
    const effectiveDeclarations = React.useMemo(
        () => withPortraitDeclarations(declarations, portraits),
        [declarations, portraits]
    );

    /**
     * Images this studio produced declare themselves: a Seedream render, a
     * frame captured from a Seedance clip, a gallery still. Making the user
     * classify our own output would be busywork with one honest answer.
     */
    const declareGeneratedReference = React.useCallback(
        (url: string, model?: string) => {
            const key = refKey(url);
            if (!key) return;
            setDeclaration(key, {
                origin: originForGeneratedImage(model),
                declaredAt: Date.now(),
                ...(model ? { model } : {})
            });
        },
        [setDeclaration]
    );

    const handleDeclareReference = React.useCallback(
        (url: string, origin: ReferenceOrigin) => {
            const key = refKey(url);
            if (!key) return;
            setDeclaration(key, {
                ...(declarations[key] ?? {}),
                origin,
                declaredAt: Date.now()
            });
        },
        [declarations, setDeclaration]
    );

    // Showcase → creation form. Settings are reconciled against the target
    // model first (see gallery-preset), because programmatic setState skips
    // the form's own Select-driven correction.
    const creationFormRef = React.useRef<HTMLDivElement>(null);

    const applyPreset = React.useCallback(
        (item: GalleryItem) => {
            const p = reconcilePreset(item.params);
            const refs = p.reference_image_urls ?? (p.input_reference_url ? [p.input_reference_url] : []);
            setCreateModel(p.model);
            setCreatePrompt(p.prompt);
            setCreateRatio(p.ratio);
            setCreateResolution(p.resolution);
            setCreateSeconds(p.seconds);
            setCreateAudio(p.generate_audio);
            setCreateCameraFixed(p.camera_fixed ?? false);
            setCreateReferenceUrls(refs);
            setCreateLastFrameUrl(p.input_reference_url ? (p.last_frame_url ?? '') : '');
            setCreateReferenceAudioUrl(refs.length >= 2 ? (p.reference_audio_url ?? '') : '');
            setCreateReferenceVideoUrls(
                refs.length >= 2 ? (p.reference_video_urls ?? []).slice(0, MAX_REFERENCE_VIDEOS) : []
            );
            setCreateSeed(p.seed);
            setCreateWatermark(p.watermark ?? false);
            setError(p.adjusted.length ? `Adjusted for ${p.model}: ${p.adjusted.join(', ')}` : null);
            creationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        [setError]
    );

    const loadSharedSettings = React.useCallback(
        async (shareId: string) => {
            try {
                const share = await fetchShare(shareId);
                if (!share) {
                    setError('Shared settings were not found.');
                    return;
                }

                const { params, adjusted } = shareParamsToForm(share.prompt, share.params);
                setCreateModel(params.model);
                setCreatePrompt(params.prompt);
                setCreateRatio(params.ratio);
                setCreateResolution(params.resolution);
                setCreateSeconds(params.seconds);
                setCreateAudio(params.generate_audio);
                setCreateCameraFixed(params.camera_fixed ?? false);
                setCreateReferenceUrls([]);
                setCreateLastFrameUrl('');
                setCreateReferenceAudioUrl('');
                setCreateReferenceVideoUrls([]);
                setCreateSeed(params.seed);
                setCreateWatermark(params.watermark ?? false);
                setActiveTab('video');
                setShareNotice('Loaded shared settings — generate to recreate');
                setError(adjusted.length ? `Adjusted shared settings: ${adjusted.join(', ')}` : null);
                creationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (err) {
                console.error('Error loading share:', err);
                setError(err instanceof Error ? err.message : 'Could not load shared settings.');
            }
        },
        [setError]
    );

    const loadedShareIdRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        const url = new URL(window.location.href);
        const shareId = url.searchParams.get('share')?.trim();
        if (!shareId || loadedShareIdRef.current === shareId) return;
        loadedShareIdRef.current = shareId;

        url.searchParams.delete('share');
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        void loadSharedSettings(shareId);
    }, [loadSharedSettings]);

    const applyReferenceFrame = React.useCallback(
        (item: GalleryItem, frameUrl: string) => {
            declareGeneratedReference(frameUrl, item.params.model);
            setCreateModel(item.params.model);
            setCreateRatio(item.params.ratio);
            setCreateReferenceUrls([frameUrl]);
            setCreateLastFrameUrl('');
            setCreateReferenceAudioUrl('');
            setCreateReferenceVideoUrls([]);
            // Leave the prompt to the user: describing the motion is the point of
            // image-to-video, and inheriting the original prompt fights that.
            setCreatePrompt('');
            creationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        [declareGeneratedReference]
    );

    React.useEffect(() => {
        if (createReferenceUrls.length !== 1 && createLastFrameUrl) {
            setCreateLastFrameUrl('');
        }
    }, [createReferenceUrls.length, createLastFrameUrl]);

    const isMultiReferenceMode = maxReferenceImages(createModel) > 1 && createReferenceUrls.length >= 2;
    const wasMultiReferenceModeRef = React.useRef(isMultiReferenceMode);
    React.useEffect(() => {
        if (wasMultiReferenceModeRef.current && !isMultiReferenceMode) {
            if (createReferenceAudioUrl) {
                setCreateReferenceAudioUrl('');
            }
            if (createReferenceVideoUrls.length) {
                setCreateReferenceVideoUrls([]);
            }
        }
        wasMultiReferenceModeRef.current = isMultiReferenceMode;
    }, [isMultiReferenceMode, createReferenceAudioUrl, createReferenceVideoUrls.length]);

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
    const [isPortraitEnabled, setIsPortraitEnabled] = React.useState(false);
    const [imageModels, setImageModels] = React.useState<ImageModel[]>([]);
    React.useEffect(() => {
        void mediaArchiveEnabled().then(setUploadEnabled);
        void loadPortraitEnabled().then(setIsPortraitEnabled);
        void loadImageModels().then(setImageModels);
    }, []);
    const imageGenerationEnabled = imageModels.length > 0;

    const handleUploadImage = React.useCallback(
        async (file: File): Promise<string> => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) before uploading images.');
            }
            return uploadReferenceImage(file, key, fileNameWithoutExtension(file.name));
        },
        [resolveKey]
    );

    const handleUploadAudio = React.useCallback(
        async (file: File): Promise<string> => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) before uploading audio.');
            }
            return uploadReferenceAudio(file, key, fileNameWithoutExtension(file.name));
        },
        [resolveKey]
    );

    const handleSynthesizeSpeech = React.useCallback(
        async (text: string, voice: TtsVoice): Promise<string> => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) to generate voiceover.');
            }

            const model = await ttsModel();
            if (!model) {
                throw new Error('Voiceover generation is not configured on this deployment.');
            }

            const speech = await synthesizeSpeech(text, key, model, process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL, voice);
            const assetName = voiceoverAssetName(text);
            const file = new File([speech], `${assetName}.mp3`, { type: 'audio/mpeg' });
            return uploadReferenceAudio(file, key, assetName);
        },
        [resolveKey]
    );

    const handleUploadVideo = React.useCallback(
        async (file: File): Promise<string> => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) before uploading video.');
            }
            return uploadReferenceVideo(file, key, fileNameWithoutExtension(file.name));
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
                url = await uploadReferenceImage(file, key, fileNameWithoutExtension(file.name));
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

            declareGeneratedReference(url, record.model);
            setCreateReferenceUrls([url]);
            setCreateLastFrameUrl('');
            setCreateReferenceAudioUrl('');
            setCreateReferenceVideoUrls([]);
            setActiveTab('video');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [declareGeneratedReference, resolveKey]
    );

    const handleLoadAssets = React.useCallback(async () => {
        if (!uploadEnabled) return [];
        const key = await resolveKey();
        if (!key) {
            throw new Error('Sign in at xcity.ai (or set an API key) to view your assets.');
        }
        return listUserAssets(key);
    }, [resolveKey, uploadEnabled]);

    const handleStartPortraitSession = React.useCallback(
        async (origin: string) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) before verifying a person.');
            }
            return createPortraitSession(origin, key);
        },
        [resolveKey]
    );

    const handleLoadPortraitGroups = React.useCallback(
        async (type?: PortraitGroupQueryType) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) to view portrait groups.');
            }
            return (await listPortraitGroups(key, type)).groups;
        },
        [resolveKey]
    );

    const handleCreatePortraitGroup = React.useCallback(
        async (name: string) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) before creating a virtual character.');
            }
            return createPortraitGroup(name, key);
        },
        [resolveKey]
    );

    const handleCreatePortraitAsset = React.useCallback(
        async (input: { groupId: string; url: string; name: string; assetType?: 'Image' | 'Video' | 'Audio' }) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) before adding a portrait image.');
            }
            return createPortraitAsset(input, key);
        },
        [resolveKey]
    );

    const handleGetPortraitAsset = React.useCallback(
        async (assetId: string) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) to check portrait image status.');
            }
            return getPortraitAsset(assetId, key);
        },
        [resolveKey]
    );

    const handleGetPortraitStatus = React.useCallback(async () => {
        const key = await resolveKey();
        if (!key) {
            throw new Error('Sign in at xcity.ai (or set an API key) to check the setup.');
        }
        return fetchPortraitStatus(key);
    }, [resolveKey]);

    const handleLoadAssemblyAudioAssets = React.useCallback(async (): Promise<UserAsset[]> => {
        const key = await resolveKey();
        if (!key) {
            throw new Error('Sign in at xcity.ai (or set an API key) to view your audio assets.');
        }
        return (await listUserAssets(key)).filter((asset) => asset.kind === 'audio');
    }, [resolveKey]);

    const handleLoadCommunity = React.useCallback(() => {
        return fetchCommunityList();
    }, []);

    const handleLoadCommunityQueue = React.useCallback(async () => {
        const key = await resolveKey();
        if (!key) return null;
        return fetchCommunityQueue(key);
    }, [resolveKey]);

    const handleReviewCommunityItem = React.useCallback(
        async (shareId: string, action: CommunityReviewAction) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) to review community submissions.');
            }
            await reviewCommunityItem(shareId, action, key);
        },
        [resolveKey]
    );

    const handleCommunityRecreate = React.useCallback(
        (shareId: string) => {
            void loadSharedSettings(shareId);
        },
        [loadSharedSettings]
    );

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

    /** Assets tab -> video form: append the video to the reference video list. */
    const handleUseAssetAsReferenceVideo = React.useCallback((url: string) => {
        setCreateReferenceVideoUrls((prev) =>
            prev.includes(url) ? prev : [...prev, url].slice(0, MAX_REFERENCE_VIDEOS)
        );
        setActiveTab('video');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

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

    const handleBreakdownScript = React.useCallback(
        async (script: string) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) to use script breakdown.');
            }
            return breakdownScript(script, key, process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL);
        },
        [resolveKey]
    );

    const handleTranscribeVideo = React.useCallback(
        async (blob: Blob): Promise<CaptionSegment[]> => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) to generate captions.');
            }

            const model = await transcribeModel();
            if (!model) {
                throw new Error('Auto-captioning is not configured on this deployment.');
            }

            return transcribeVideo(blob, key, model, process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL);
        },
        [resolveKey]
    );

    const handleInvalidApiKey = React.useCallback(
        (message = 'Your Xcity API key was rejected. Please sign in again or enter a new key.') => {
            invalidateKey();
            setIsApiKeyDialogOpen(true);
            setError(message);
        },
        [invalidateKey, setError]
    );

    /** Downloads a finished video into IndexedDB and finalizes its history entry. */
    const downloadAndStoreVideo = React.useCallback(
        async (job: VideoJob) => {
            console.log(`Downloading video for job: ${job.id}`);

            // Ark attaches the CDN link AFTER the job first reports completed,
            // and the gap scales with the render: short clips take seconds,
            // long clips and 4K clips take minutes. Poll with backoff for
            // ~1 min on short clips, ~6 min for clips longer than 12s.
            let sourceUrl = job.output_url;
            const isLongClip = Number(job.seconds) > 12;
            const retryDelaysMs = isLongClip
                ? [2_000, 4_000, 8_000, 16_000, 30_000, 60_000, 60_000, 60_000, 60_000, 60_000]
                : [2_000, 4_000, 8_000, 16_000, 30_000];
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
                    markPreviewUnresolved(job.id, true);
                    setError(
                        `The gateway reported the video as completed but never exposed its download link (job ${job.id}). ` +
                            'Select it from History in a moment to retry, or check the TokenHub logs.',
                        'output'
                    );
                }
            }
        },
        [videoService, setRemoteSource, updateItem, handleInvalidApiKey, markPreviewUnresolved, setError]
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
                const historyItem = history.find((item) => item.id === job.id);
                const createParams =
                    typeof job.seed === 'number' &&
                    historyItem?.createParams &&
                    historyItem.createParams.seed === undefined
                        ? { ...historyItem.createParams, seed: job.seed }
                        : undefined;
                updateItem(job.id, {
                    progress: 100,
                    status: 'completed',
                    ...(createParams ? { createParams } : {})
                });
                void downloadAndStoreVideo(job);
            },
            onFailed: (job: VideoJob) => {
                updateItem(job.id, {
                    status: 'failed',
                    costDetails: null,
                    error: job.error?.message || 'Video generation failed'
                });
                setError(job.error?.message || 'Video generation failed', 'output');
            },
            onInvalidKey: () => handleInvalidApiKey()
        }),
        [history, updateItem, downloadAndStoreVideo, handleInvalidApiKey, setError]
    );

    const { activeJobs, addJob, replaceJob, removeJob, restoreJobs, clearJobs } = useVideoJobs(
        videoService,
        jobCallbacks
    );

    // Permanent R2 copies for completed videos (see hook for the why).
    const { retryArchive } = useMediaArchive({
        history,
        enabled: !isInitialLoad,
        service: videoService,
        resolveKey,
        onArchived: (id, url) => {
            setRemoteSource(id, url);
            markPreviewUnresolved(id, false);
            updateItem(id, { storedUrl: url, mediaExpired: false });
        },
        onExpired: (id) => {
            const item = history.find((candidate) => candidate.id === id);
            if (!item || item.storedUrl || hasLocalCopy(id)) return;
            updateItem(id, { mediaExpired: true });
        }
    });

    usePosterBackfill({
        history,
        enabled: !isInitialLoad
    });

    const blockedReferencesForParams = React.useCallback(
        (params: VideoJobCreate): string[] =>
            imageReferenceUrlsFromParams(params).filter((url) => {
                const declaration = effectiveDeclarations[refKey(url)];
                if (!declarationSatisfied(declaration)) return true;
                return maxReferenceImages(params.model) <= 1 && referenceRequiresAssetLibrary(url, declaration);
            }),
        [effectiveDeclarations]
    );

    const firstReferenceBlockReason = React.useCallback(
        (model: VideoModel, urls: string[]): string | null => {
            const first = urls[0];
            if (!first) return null;
            const declaration = effectiveDeclarations[refKey(first)];
            if (maxReferenceImages(model) <= 1 && referenceRequiresAssetLibrary(first, declaration)) {
                return ASSET_LIBRARY_MODEL_BLOCK_REASON;
            }
            return declarationBlockReason(declaration);
        },
        [effectiveDeclarations]
    );

    // Resume polling for every in-flight history item — including ones
    // created on another device (cloud-synced) or before a crash. The gateway
    // retrieve is stateless, so an id is all it takes: stale tasks resolve to
    // their terminal status (or 404 → failed) on the first poll. Runs on
    // every history change because the cloud pull can land after boot; a ref
    // dedupes so each id is only restored once per session. Gated on a
    // resolved key: resuming before the SSO key arrives would make the first
    // poll throw InvalidApiKeyError and pop the key dialog uninvited.
    const resumedIdsRef = React.useRef<Set<string>>(new Set());
    React.useEffect(() => {
        if (isInitialLoad || !apiKey) return;

        const processingItems = history.filter(
            (item) => item.status === 'processing' && !resumedIdsRef.current.has(item.id) && !activeJobs.has(item.id)
        );
        if (processingItems.length === 0) return;

        for (const item of processingItems) resumedIdsRef.current.add(item.id);
        console.log(`Resuming ${processingItems.length} in-flight job(s)`);
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
    }, [isInitialLoad, apiKey, history, activeJobs, restoreJobs]);

    const handleCreateVideo = async (formData: CreationFormData) => {
        setError(null);
        setShareNotice(null);
        const blockedReferences = blockedReferencesForParams(formData);
        if (blockedReferences.length > 0) {
            setError(
                firstReferenceBlockReason(formData.model, blockedReferences) ?? 'Choose where this image came from.'
            );
            return;
        }
        setIsSubmitting(true);

        // Resolve the key at submit time — an SSO key that lands after this
        // handler's render is invisible to its closure, and keys rotate.
        const activeKey = await resolveKey();
        if (!activeKey) {
            setError('Could not read your Xcity API key. Sign in at xcity.ai and retry.');
            setIsSubmitting(false);
            return;
        }

        // The provider downloads every reference image server-side; a stale
        // link (e.g. an asset deleted after being added here) fails there as
        // an opaque "resource download failed". Our worker's URLs are
        // CORS-open, so verify those up front and name the broken image.
        const workerBase = await mediaWorkerUrl();
        // Ark cannot fetch *.workers.dev (blocklisted), which is why the
        // worker moved to a custom domain — rebase legacy links (history
        // reuse, stale form state) onto the current origin.
        const rebase = (url: string): string => {
            if (isAssetReferenceUrl(url)) return url;
            try {
                const u = new URL(url);
                if (
                    workerBase &&
                    u.hostname.endsWith('.workers.dev') &&
                    u.pathname.startsWith('/media/') &&
                    !workerBase.includes(u.hostname)
                ) {
                    return `${workerBase}${u.pathname}`;
                }
            } catch {
                // Not a parsable URL — leave it for the gateway to reject.
            }
            return url;
        };
        if (formData.input_reference_url) {
            formData.input_reference_url = rebase(formData.input_reference_url);
        }
        if (formData.last_frame_url) {
            formData.last_frame_url = rebase(formData.last_frame_url);
        }
        if (formData.reference_image_urls) {
            formData.reference_image_urls = formData.reference_image_urls.map(rebase);
        }
        if (formData.reference_audio_url) {
            formData.reference_audio_url = rebase(formData.reference_audio_url);
        }
        if (formData.reference_video_urls) {
            formData.reference_video_urls = formData.reference_video_urls.map(rebase);
        }

        // Ark's server-side fetcher cannot reliably download from
        // Cloudflare-fronted hosts (bot mitigation challenges it while
        // browsers pass), so inline every reference media item as a Base64 data
        // URI — officially supported ("URL, Base64 encoding, or asset ID").
        // The request gets the inlined copies; history keeps the URLs (a
        // multi-MB data URI would blow the localStorage quota).
        const requestParams: CreationFormData = { ...formData };
        let totalChars = 0;
        const refUrls =
            formData.reference_image_urls ??
            (formData.input_reference_url
                ? [formData.input_reference_url, ...(formData.last_frame_url ? [formData.last_frame_url] : [])]
                : []);
        if (refUrls.length) {
            const inlined: string[] = [];
            for (let i = 0; i < refUrls.length; i++) {
                const url = refUrls[i];
                if (isAssetReferenceUrl(url)) {
                    inlined.push(url);
                    continue;
                }
                const isWorkerHosted = Boolean(workerBase && url.startsWith(workerBase));
                const dataUri = url.startsWith('data:') ? url : await imageUrlToDataUri(url);
                if (!dataUri) {
                    if (isWorkerHosted) {
                        // Our own storage is CORS-open — a failed read means the
                        // object is gone (e.g. deleted from Assets).
                        setError(
                            `Reference image ${i + 1} is no longer accessible — it may have been deleted from Assets. Remove it from the list and upload it again.`
                        );
                        setIsSubmitting(false);
                        return;
                    }
                    // External host without CORS: pass the URL through and let
                    // the provider try fetching it directly.
                    inlined.push(url);
                    continue;
                }
                totalChars += dataUri.length;
                inlined.push(dataUri);
            }
            if (formData.reference_image_urls) {
                requestParams.reference_image_urls = inlined;
            } else if (formData.input_reference_url) {
                requestParams.input_reference_url = inlined[0];
                if (formData.last_frame_url) {
                    requestParams.last_frame_url = inlined[1];
                }
            }
        }
        if (formData.reference_audio_url && formData.reference_image_urls?.length) {
            const isWorkerHosted = Boolean(workerBase && formData.reference_audio_url.startsWith(workerBase));
            const dataUri = formData.reference_audio_url.startsWith('data:')
                ? formData.reference_audio_url
                : await audioUrlToDataUri(formData.reference_audio_url);
            if (!dataUri) {
                if (isWorkerHosted) {
                    setError(
                        'Background audio is no longer accessible — it may have been deleted from Assets. Remove it and upload it again.'
                    );
                    setIsSubmitting(false);
                    return;
                }
            } else {
                totalChars += dataUri.length;
                requestParams.reference_audio_url = dataUri;
            }
        }
        if (formData.reference_video_urls?.length && formData.reference_image_urls?.length) {
            const inlinedVideos: string[] = [];
            for (let i = 0; i < formData.reference_video_urls.length; i++) {
                const url = formData.reference_video_urls[i];
                const isWorkerHosted = Boolean(workerBase && url.startsWith(workerBase));
                const dataUri = url.startsWith('data:') ? url : await videoUrlToDataUri(url);
                if (!dataUri) {
                    if (isWorkerHosted) {
                        setError(
                            `Reference video ${i + 1} is no longer accessible — it may have been deleted from Assets. Remove it from the list and upload it again.`
                        );
                        setIsSubmitting(false);
                        return;
                    }
                    // External host without CORS: pass the URL through and let
                    // the provider try fetching it directly.
                    inlinedVideos.push(url);
                    continue;
                }
                totalChars += dataUri.length;
                inlinedVideos.push(dataUri);
            }
            requestParams.reference_video_urls = inlinedVideos;
        }
        if (totalChars > 30_000_000) {
            setError('Reference media are too large to submit (over ~20 MB combined). Use fewer or smaller files.');
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
            const result = await videoService.createVideo(requestParams);
            console.log('Video job created:', result.id);

            // Normalize gateway-shaped fields (size "16x9", seconds "5") to
            // the display values the form produced.
            const job: VideoJob = {
                ...result,
                prompt: formData.prompt,
                size: displaySize,
                seconds: String(formData.seconds)
            };
            const createParams =
                typeof job.seed === 'number' && formData.seed === undefined
                    ? { ...formData, seed: job.seed }
                    : formData;

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
                createParams,
                costDetails: calculateVideoCost({
                    model: formData.model,
                    ratio: formData.ratio,
                    resolution: formData.resolution,
                    seconds: formData.seconds,
                    generateAudio: formData.generate_audio,
                    inputVideoSeconds: inputVideoSecondsFromParams(formData)
                }),
                draft: formData.draft || undefined,
                finalResolution: formData.draft ? formData.final_resolution : undefined,
                status: 'processing',
                progress: 0
            });
        } catch (err: unknown) {
            console.error('Error creating video:', err);
            if (err instanceof InvalidApiKeyError) {
                handleInvalidApiKey(err.message);
            } else if (err instanceof RealPersonImageError) {
                // Only point at the verification flow when this deployment
                // actually has it — otherwise the advice names a hidden tab.
                const canVerify = isPortraitEnabled || (await loadPortraitEnabled());
                setError(
                    canVerify
                        ? 'BytePlus blocked a reference image that appears to contain a real person. Open Assets → Verified people, verify that person once, then attach the verified photo instead of the raw image. ' +
                              `(${err.providerMessage})`
                        : 'BytePlus blocks reference images that appear to contain a real person. Using real people requires the verified-people library, which is not enabled on this deployment — ask the Xcity admin to enable it, or use a reference image without an identifiable person. ' +
                              `(${err.providerMessage})`
                );
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
            camera_fixed: false,
            watermark: false
        };
    }, []);

    const handleShareDialogOpenChange = React.useCallback((open: boolean) => {
        setIsShareDialogOpen(open);
        if (!open) {
            setShareUrlCopied(false);
            setShareDialogId('');
            setShareCommunityStatus('idle');
            setShareCommunityError(null);
        }
    }, []);

    const handleCopyShareUrl = React.useCallback(async () => {
        if (!shareDialogUrl) return;
        try {
            await navigator.clipboard.writeText(shareDialogUrl);
            setShareUrlCopied(true);
            setTimeout(() => setShareUrlCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy share URL:', err);
        }
    }, [shareDialogUrl]);

    const handleSubmitShareToCommunity = React.useCallback(async () => {
        if (!shareDialogId) return;
        setShareCommunityStatus('submitting');
        setShareCommunityError(null);
        try {
            const activeKey = await resolveKey();
            if (!activeKey) {
                throw new Error('Sign in at xcity.ai (or set an API key) before submitting to community.');
            }
            await publishToCommunity(shareDialogId, activeKey);
            setShareCommunityStatus('submitted');
        } catch (err) {
            setShareCommunityStatus('idle');
            setShareCommunityError(err instanceof Error ? err.message : 'Community submission failed.');
        }
    }, [resolveKey, shareDialogId]);

    const handleShareItem = React.useCallback(
        async (item: VideoMetadata) => {
            setIsShareDialogOpen(true);
            setShareDialogId('');
            setShareDialogUrl('');
            setShareDialogError(null);
            setShareUrlCopied(false);
            setShareCommunityStatus('idle');
            setShareCommunityError(null);
            setSharingVideoId(item.id);

            if (!item.storedUrl) {
                setShareDialogError('Archive to cloud first — wait a moment.');
                setSharingVideoId(null);
                return;
            }

            try {
                const activeKey = await resolveKey();
                if (!activeKey) {
                    throw new Error('Sign in at xcity.ai (or set an API key) before sharing.');
                }

                const share = await createShare(
                    {
                        videoId: item.id,
                        videoUrl: item.storedUrl,
                        prompt: item.prompt,
                        params: buildParamsFromItem(item),
                        title: shareTitleFromPrompt(item.prompt)
                    },
                    activeKey
                );
                setShareDialogId(share.id);
                setShareDialogUrl(share.url);
            } catch (err) {
                console.error('Error creating share:', err);
                setShareDialogError(err instanceof Error ? err.message : 'Failed to create share.');
            } finally {
                setSharingVideoId(null);
            }
        },
        [buildParamsFromItem, resolveKey]
    );

    const applyParamsToCreationForm = React.useCallback((params: CreationFormData) => {
        setCreateModel(params.model);
        setCreatePrompt(params.prompt);
        setCreateRatio(params.ratio);
        setCreateResolution(
            params.draft ? finalResolutionForDraft(params.model, params.final_resolution) : params.resolution
        );
        setCreateSeconds(params.seconds);
        setCreateAudio(params.generate_audio);
        setCreateCameraFixed(params.camera_fixed ?? false);
        const refs = params.reference_image_urls ?? (params.input_reference_url ? [params.input_reference_url] : []);
        setCreateReferenceUrls(refs);
        setCreateLastFrameUrl(refs.length === 1 ? (params.last_frame_url ?? '') : '');
        setCreateReferenceAudioUrl(refs.length >= 2 ? (params.reference_audio_url ?? '') : '');
        setCreateReferenceVideoUrls(
            refs.length >= 2 ? (params.reference_video_urls ?? []).slice(0, MAX_REFERENCE_VIDEOS) : []
        );
        setCreateSeed(params.seed);
        setCreateWatermark(params.watermark ?? false);
        setActiveTab('video');
        if (creationFormRef.current) {
            creationFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, []);

    const showReferenceDeclarationGate = React.useCallback(
        (params: CreationFormData, blockedReferences: string[]) => {
            applyParamsToCreationForm(params);
            const reason = firstReferenceBlockReason(params.model, blockedReferences);
            // Scope 'create': applyParamsToCreationForm just scrolled the user
            // to the form, so the message has to be under the Create button.
            setError(
                reason
                    ? `References need a source declaration first. ${reason}`
                    : 'References need a source declaration first.'
            );
        },
        [applyParamsToCreationForm, firstReferenceBlockReason, setError]
    );

    /** 做同款 — fill the create form with an item's parameters. */
    const handleReuseItem = React.useCallback(
        (item: VideoMetadata) => {
            applyParamsToCreationForm(buildParamsFromItem(item));
        },
        [applyParamsToCreationForm, buildParamsFromItem]
    );

    /** 重新生成 — resubmit an item with its exact parameters. */
    const handleRegenerateItem = (item: VideoMetadata) => {
        const params = buildParamsFromItem(item);
        const blockedReferences = blockedReferencesForParams(params);
        if (blockedReferences.length > 0) {
            showReferenceDeclarationGate(params, blockedReferences);
            return;
        }
        void handleCreateVideo(params);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /** Finalize — rerun a draft at its selected final resolution with the same seed. */
    const handleFinalizeItem = (item: VideoMetadata) => {
        const params = buildParamsFromItem(item);
        const finalResolution = finalResolutionForDraft(params.model, item.finalResolution ?? params.final_resolution);
        const finalParams: CreationFormData = {
            ...params,
            draft: false,
            resolution: finalResolution
        };
        delete finalParams.final_resolution;
        const blockedReferences = blockedReferencesForParams(finalParams);
        if (blockedReferences.length > 0) {
            showReferenceDeclarationGate(finalParams, blockedReferences);
            return;
        }
        void handleCreateVideo(finalParams);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /** 续片 — continue a completed video from its final frame. */
    const handleExtendVideo = React.useCallback(
        async (item: VideoMetadata) => {
            setError(null);

            try {
                if (!(await mediaArchiveEnabled())) {
                    setError('Extend requires media storage to be configured', 'output');
                    return;
                }

                const record = await db.videos.get(item.id);
                let videoBlob = record?.blob;
                if (!videoBlob) {
                    const src = item.storedUrl ?? getVideoSrc(item.id);
                    if (!src) {
                        throw new Error('Video source not found. Select the video from History and try again.');
                    }
                    let res: Response;
                    try {
                        res = await fetch(src);
                    } catch {
                        // The provider's CDN is not CORS-open; only our own R2
                        // copy can be read back into a blob.
                        throw new Error(
                            'Could not read this video for extending — wait for its cloud copy to finish archiving, then retry.'
                        );
                    }
                    if (!res.ok) {
                        throw new Error(`Could not load the video source (${res.status}).`);
                    }
                    videoBlob = await res.blob();
                }

                const frameBlob = await captureVideoLastFrame(videoBlob);
                if (!frameBlob) {
                    throw new Error('Could not capture the last frame from this video.');
                }

                const frameFile = new File([frameBlob], `${item.id}-last-frame.webp`, {
                    type: frameBlob.type || 'image/webp'
                });
                const frameUrl = await handleUploadImage(frameFile);
                declareGeneratedReference(frameUrl, item.model);
                const params = buildParamsFromItem(item);

                setCreateModel(params.model);
                setCreatePrompt('');
                setCreateRatio(params.ratio);
                setCreateResolution(params.resolution);
                setCreateSeconds(params.seconds);
                setCreateAudio(params.generate_audio);
                setCreateCameraFixed(params.camera_fixed ?? false);
                setCreateReferenceUrls([frameUrl]);
                setCreateLastFrameUrl('');
                setCreateReferenceAudioUrl('');
                setCreateReferenceVideoUrls([]);
                setCreateSeed(params.seed);
                setCreateWatermark(params.watermark ?? false);
                setActiveTab('video');
                creationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (err) {
                console.error('Error extending video:', err);
                if (err instanceof InvalidApiKeyError) {
                    handleInvalidApiKey(err.message);
                } else {
                    setError(err instanceof Error ? err.message : 'Failed to extend video', 'output');
                }
            }
        },
        [buildParamsFromItem, declareGeneratedReference, getVideoSrc, handleInvalidApiKey, handleUploadImage, setError]
    );

    const handleExtendCurrentVideo = React.useCallback(
        (videoId: string) => {
            const item = history.find((candidate) => candidate.id === videoId);
            if (item) {
                void handleExtendVideo(item);
                return;
            }

            // The output panel can outlive its history entry (deleted here, or
            // dropped by a merge with another device). Everything extend needs
            // is on the job itself, so rebuild the entry instead of dead-ending
            // the button with "Could not find this video in history."
            const job = activeJobs.get(videoId);
            if (!job) {
                setError('Could not find this video.', 'output');
                return;
            }
            console.warn(`Extending ${videoId} from its job — no history entry for it.`);
            void handleExtendVideo({
                id: videoId,
                timestamp: job.created_at * 1000,
                filename: `${videoId}.mp4`,
                storageModeUsed: 'indexeddb',
                durationMs: 0,
                model: job.model,
                size: job.size,
                seconds: Number(job.seconds) || DEFAULT_SECONDS,
                prompt: job.prompt ?? '',
                mode: 'create',
                status: 'completed',
                costDetails: null
            });
        },
        [activeJobs, history, handleExtendVideo, setError]
    );

    const handleFinalizeCurrentVideo = (videoId: string) => {
        const item = history.find((candidate) => candidate.id === videoId);
        if (!item) {
            setError('Could not find this video in history.', 'output');
            return;
        }
        handleFinalizeItem(item);
    };

    /**
     * Resolves a playback source for a history item.
     *
     * Order: a local blob wins, then the permanent R2 copy (never expires,
     * CORS-open), then the provider's current signed link — re-read from the
     * gateway because Ark links last 24 h and whatever a poll cached may be
     * dead. Preferring storedUrl over an already-registered source matters:
     * the link captured at generation time expires while the tab is open, and
     * the panel used to keep replaying that corpse.
     */
    const resolvePlaybackSource = React.useCallback(
        async (item: VideoMetadata, options: { force?: boolean } = {}) => {
            if (hasLocalCopy(item.id)) {
                markPreviewUnresolved(item.id, false);
                return;
            }

            if (item.storedUrl) {
                if (getVideoSrc(item.id) !== item.storedUrl) setRemoteSource(item.id, item.storedUrl);
                markPreviewUnresolved(item.id, false);
                return;
            }

            if (item.status === 'failed') return;

            if (item.mediaExpired || providerLinkLikelyDead(item, Date.now())) {
                updateItem(item.id, { mediaExpired: true });
                return;
            }

            // Without force, don't re-probe what already plays or what we
            // already know the gateway has nothing for.
            if (!options.force && (hasSource(item.id) || unresolvedPreviewIdsRef.current.has(item.id))) return;

            try {
                const fresh = await videoService.retrieveVideo(item.id);
                if (fresh.output_url) {
                    setRemoteSource(item.id, fresh.output_url);
                    markPreviewUnresolved(item.id, false);
                } else {
                    markPreviewUnresolved(item.id, true);
                }
            } catch (err) {
                markPreviewUnresolved(item.id, true);
                console.warn(`Could not resolve a source for ${item.id}:`, err);
            }
        },
        [getVideoSrc, hasLocalCopy, hasSource, markPreviewUnresolved, setRemoteSource, updateItem, videoService]
    );

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
        if (!tracked)
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

        void resolvePlaybackSource(item);
    };

    /** "Retry" on an unplayable preview: probe again, and re-arm archiving. */
    const handleRetryPreview = React.useCallback(() => {
        if (!currentJobId) return;
        const item = history.find((candidate) => candidate.id === currentJobId);
        if (!item) return;
        markPreviewUnresolved(item.id, false);
        retryArchive(item.id);
        void resolvePlaybackSource(item, { force: true });
    }, [currentJobId, history, markPreviewUnresolved, resolvePlaybackSource, retryArchive]);

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
            setError(err instanceof Error ? err.message : 'Failed to delete video', 'output');
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
            setError(err instanceof Error ? err.message : 'Failed to download video', 'output');
        }
    };

    const handleSaveApiKey = async (rawKey: string) => {
        await saveManualKey(rawKey);
        setError(null);
    };

    const currentJob = currentJobId ? activeJobs.get(currentJobId) : null;
    const currentHistoryItem = currentJobId ? history.find((item) => item.id === currentJobId) : undefined;
    const currentHistoryItemIsDraft =
        currentHistoryItem?.draft === true || currentHistoryItem?.createParams?.draft === true;
    const currentMediaExpired = Boolean(
        currentHistoryItem?.status === 'completed' &&
            !currentHistoryItem.storedUrl &&
            !hasLocalCopy(currentHistoryItem.id) &&
            (currentHistoryItem.mediaExpired || providerLinkLikelyDead(currentHistoryItem, Date.now()))
    );
    const currentVideoSrc = currentJobId && !currentMediaExpired ? getVideoSrc(currentJobId) : null;
    const currentThumbnailSrc = currentJobId ? getThumbnailSrc(currentJobId) : null;

    // Without SSO the manual key is the only way in — gate until one is set.
    const isApiKeyGateBlocked = !XCITY_SSO_ENABLED && !apiKey;

    const videoTabContent = (
        <>
            {shareNotice && (
                <Alert className='border-white/15 bg-white/5 text-white'>
                    <AlertTitle className='text-white'>Shared Settings</AlertTitle>
                    <AlertDescription className='text-white/70'>{shareNotice}</AlertDescription>
                </Alert>
            )}
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
                                        <p className='text-lg font-medium text-white'>Connecting your Xcity account…</p>
                                        <p className='text-sm text-white/50'>
                                            Fetching your TokenHub key from xcity.ai
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className='text-lg font-medium text-white'>Sign in with Xcity</p>
                                        <p className='max-w-sm text-sm text-white/60'>
                                            Video generation runs on your own Xcity plan. Sign in at xcity.ai and come
                                            back — your TokenHub key is picked up automatically.
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
                                declarations={effectiveDeclarations}
                                onDeclareReference={handleDeclareReference}
                                characters={characters}
                                portraits={portraits}
                                lastFrameUrl={createLastFrameUrl}
                                setLastFrameUrl={setCreateLastFrameUrl}
                                referenceAudioUrl={createReferenceAudioUrl}
                                setReferenceAudioUrl={setCreateReferenceAudioUrl}
                                referenceVideoUrls={createReferenceVideoUrls}
                                setReferenceVideoUrls={setCreateReferenceVideoUrls}
                                seed={createSeed}
                                setSeed={setCreateSeed}
                                watermark={createWatermark}
                                setWatermark={setCreateWatermark}
                                onUploadImage={uploadEnabled ? handleUploadImage : undefined}
                                onUploadAudio={uploadEnabled ? handleUploadAudio : undefined}
                                onSynthesizeSpeech={uploadEnabled ? handleSynthesizeSpeech : undefined}
                                onUploadVideo={uploadEnabled ? handleUploadVideo : undefined}
                                onOptimizePrompt={handleOptimizePrompt}
                                onBreakdownScript={handleBreakdownScript}
                                // Only offer the jump when the Assets tab actually exists —
                                // it is gated on the media worker / portrait library.
                                onOpenAssets={
                                    uploadEnabled || isPortraitEnabled ? () => setActiveTab('assets') : undefined
                                }
                                error={createError}
                            />
                        )}
                    </ApiKeyGate>
                </div>
                <div className='flex min-h-[600px] flex-col lg:col-span-1'>
                    <VideoOutput
                        job={currentJob || null}
                        videoSrc={currentVideoSrc}
                        thumbnailSrc={currentThumbnailSrc}
                        mediaExpired={currentMediaExpired}
                        isLoading={
                            currentJob ? currentJob.status === 'queued' || currentJob.status === 'in_progress' : false
                        }
                        onDownload={handleDownloadVideo}
                        onExtend={handleExtendCurrentVideo}
                        onFinalize={currentHistoryItemIsDraft ? handleFinalizeCurrentVideo : undefined}
                        onShare={handleShareItem}
                        shareItem={currentHistoryItem}
                        isSharePending={Boolean(currentHistoryItem && sharingVideoId === currentHistoryItem.id)}
                        previewUnavailable={Boolean(currentJobId && unresolvedPreviewIds.has(currentJobId))}
                        onRetryPreview={handleRetryPreview}
                        error={outputError}
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
                    hasLocalCopy={hasLocalCopy}
                    onRetryArchive={retryArchive}
                    onDeleteItem={handleDeleteVideo}
                    onReuseItem={handleReuseItem}
                    onRegenerateItem={handleRegenerateItem}
                    onFinalizeItem={handleFinalizeItem}
                    onExtendItem={handleExtendVideo}
                    onShareItem={handleShareItem}
                    sharePendingId={sharingVideoId}
                    loadAudioAssets={handleLoadAssemblyAudioAssets}
                    onTranscribeVideo={handleTranscribeVideo}
                />
            </div>
        </>
    );

    return (
        <main className='flex flex-col items-center bg-black p-4 text-white md:p-8 lg:p-12'>
            <ApiKeyDialog isOpen={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen} onSave={handleSaveApiKey} />
            <Dialog open={isShareDialogOpen} onOpenChange={handleShareDialogOpenChange}>
                <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[460px]'>
                    <DialogHeader>
                        <DialogTitle className='text-white'>Share Video</DialogTitle>
                        <DialogDescription className='text-neutral-400'>
                            Anyone with this link can view the video and recreate its prompt settings.
                        </DialogDescription>
                    </DialogHeader>
                    {sharingVideoId ? (
                        <div className='flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70'>
                            <Loader2 className='h-4 w-4 animate-spin' />
                            Creating share link...
                        </div>
                    ) : shareDialogError ? (
                        <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200'>
                            {shareDialogError}
                        </div>
                    ) : shareDialogUrl ? (
                        <div className='space-y-3'>
                            <Input
                                readOnly
                                value={shareDialogUrl}
                                onFocus={(event) => event.currentTarget.select()}
                                className='border-white/20 bg-black text-white'
                                aria-label='Share URL'
                            />
                            <p className='text-xs text-neutral-400'>
                                Recreate links load prompt and generation settings only. Reference media are not shared.
                            </p>
                            {shareCommunityStatus === 'submitted' ? (
                                <div className='flex items-center gap-2 rounded-md border border-green-500/25 bg-green-500/10 px-3 py-2 text-sm text-green-200'>
                                    <Check className='h-4 w-4' />
                                    Submitted for review ✓
                                </div>
                            ) : (
                                <Button
                                    type='button'
                                    variant='secondary'
                                    onClick={() => void handleSubmitShareToCommunity()}
                                    disabled={shareCommunityStatus === 'submitting' || !shareDialogId}
                                    className='w-full bg-white/10 text-white hover:bg-white/20'>
                                    {shareCommunityStatus === 'submitting' && (
                                        <Loader2 className='h-4 w-4 animate-spin' />
                                    )}
                                    Submit to community
                                </Button>
                            )}
                            {shareCommunityError && <p className='text-xs text-red-300'>{shareCommunityError}</p>}
                        </div>
                    ) : null}
                    <DialogFooter>
                        {shareDialogUrl && (
                            <>
                                <Button
                                    type='button'
                                    variant='secondary'
                                    onClick={handleCopyShareUrl}
                                    className='bg-white/10 text-white hover:bg-white/20'>
                                    {shareUrlCopied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
                                    {shareUrlCopied ? 'Copied' : 'Copy'}
                                </Button>
                                <Button asChild className='bg-white text-black hover:bg-white/90'>
                                    <a href={shareDialogUrl} target='_blank' rel='noreferrer'>
                                        Open
                                    </a>
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className='w-full max-w-7xl space-y-6'>
                {imageGenerationEnabled || uploadEnabled || isPortraitEnabled ? (
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StudioTab)}>
                        <TabsList className='mb-4 border border-white/10 bg-white/5'>
                            <TabsTrigger
                                value='video'
                                className='px-6 text-white/60 data-[state=active]:bg-white data-[state=active]:text-black'>
                                Video
                            </TabsTrigger>
                            {imageGenerationEnabled && (
                                <TabsTrigger
                                    value='image'
                                    className='px-6 text-white/60 data-[state=active]:bg-white data-[state=active]:text-black'>
                                    Image
                                </TabsTrigger>
                            )}
                            {(uploadEnabled || isPortraitEnabled) && (
                                <TabsTrigger
                                    value='assets'
                                    className='px-6 text-white/60 data-[state=active]:bg-white data-[state=active]:text-black'>
                                    Assets
                                </TabsTrigger>
                            )}
                            {uploadEnabled && (
                                <TabsTrigger
                                    value='community'
                                    className='px-6 text-white/60 data-[state=active]:bg-white data-[state=active]:text-black'>
                                    Community
                                </TabsTrigger>
                            )}
                        </TabsList>
                        <TabsContent value='video' className='space-y-6'>
                            {videoTabContent}
                        </TabsContent>
                        {imageGenerationEnabled && (
                            <TabsContent value='image'>
                                <ImageStudio
                                    imageModels={imageModels}
                                    onGenerate={handleGenerateImages}
                                    onAnimate={handleAnimateImage}
                                />
                            </TabsContent>
                        )}
                        {(uploadEnabled || isPortraitEnabled) && (
                            <TabsContent value='assets'>
                                <div className='min-h-[450px]'>
                                    <AssetsPanel
                                        loadAssets={handleLoadAssets}
                                        deleteAsset={handleDeleteAsset}
                                        characters={characters}
                                        addCharacter={addCharacter}
                                        removeCharacter={removeCharacter}
                                        portraitEnabled={isPortraitEnabled}
                                        portraits={portraits}
                                        addPortrait={addPortrait}
                                        removePortrait={removePortrait}
                                        startPortraitSession={handleStartPortraitSession}
                                        loadPortraitGroups={handleLoadPortraitGroups}
                                        createPortraitGroup={handleCreatePortraitGroup}
                                        createPortraitAsset={handleCreatePortraitAsset}
                                        getPortraitAsset={handleGetPortraitAsset}
                                        getPortraitStatus={handleGetPortraitStatus}
                                        onUseAsReference={handleUseAssetAsReference}
                                        onUseAsReferenceVideo={handleUseAssetAsReferenceVideo}
                                        active={activeTab === 'assets'}
                                    />
                                </div>
                            </TabsContent>
                        )}
                        {uploadEnabled && (
                            <TabsContent value='community'>
                                <div className='min-h-[450px]'>
                                    <CommunityPanel
                                        loadItems={handleLoadCommunity}
                                        loadQueue={handleLoadCommunityQueue}
                                        reviewItem={handleReviewCommunityItem}
                                        onRecreate={handleCommunityRecreate}
                                        active={activeTab === 'community'}
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
