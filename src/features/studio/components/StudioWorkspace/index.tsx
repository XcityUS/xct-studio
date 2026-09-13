'use client';

import {
    BRANDING_WATERMARK_TEXT,
    FINALIZE_UNSUPPORTED_MODEL_MESSAGE,
    MAX_REFERENCE_VIDEOS,
    SOCIAL_SHARE_TARGETS
} from './constants';
import { ensureFinalizeEditPrompt, finalResolutionForDraft, inputVideoSecondsFromParams } from './finalize';
import {
    fetchVideoContentLength,
    isReferenceVideoDownloadError,
    isWebReferenceUrl,
    referenceVideoDownloadErrorMessage,
    summarizeWebUrl
} from './references';
import { captionModeFromLanguages, shareParamsToForm, sharePromptWithinLimit, shareTitleFromItem } from './share';
import type { ErrorScope, SocialShareTarget, StudioTab, WatermarkQueueItem } from './types';
import {
    fileNameWithoutExtension,
    imageReferenceUrlsFromParams,
    legacyWatermarkedVideoId,
    normalizeWatermarkText,
    providerReferenceUrl,
    realPersonReferenceErrorMessage,
    voiceoverAssetName,
    watermarkedVideoId,
    withPortraitDeclarations
} from './utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent } from '@/components/ui/Tabs';
import { AssetsPanel } from '@/features/assets/components/AssetsPanel';
import type { ReferenceUseOptions } from '@/features/assets/components/AssetsPanel/types';
import { useMediaArchive } from '@/features/assets/hooks/use-media-archive';
import { usePosterBackfill } from '@/features/assets/hooks/use-poster-backfill';
import { useProviderAssetReview } from '@/features/assets/hooks/use-provider-asset-review';
import { useVideoSources } from '@/features/assets/hooks/use-video-sources';
import { validateAssetImage } from '@/features/assets/image/validation';
import { providerLinkLikelyDead } from '@/features/assets/media/state';
import { captureVideoLastFrame, captureVideoPoster } from '@/features/assets/media/thumbnail';
import {
    createPortraitAsset,
    createPortraitGroup,
    createPortraitSession,
    deletePortraitGroup,
    fetchPortraitStatus,
    getPortraitAsset,
    listPortraitAssets,
    listPortraitGroups,
    type PortraitGroup,
    type PortraitGroupQueryType
} from '@/features/assets/portrait/api';
import {
    ASSET_LIBRARY_MODEL_BLOCK_REASON,
    assetIdFromReferenceUrl,
    declarationBlockReason,
    declarationSatisfied,
    isAssetReferenceUrl,
    originForGeneratedImage,
    refKey,
    referenceRequiresAssetLibrary,
    type ReferenceOrigin
} from '@/features/assets/reference/origin';
import { db, type ImageRecord } from '@/features/assets/storage/db';
import { CommunityPanel } from '@/features/community/components/CommunityPanel';
import { GallerySection } from '@/features/community/components/GallerySection';
import { reconcilePreset } from '@/features/community/gallery/preset';
import type { GalleryItem } from '@/features/community/gallery/utils';
import { CreationForm, type AssetBindingOptions, type CreationFormData, type SceneAssetBindingProgress } from '@/features/generation/components/CreationForm';
import { FinalizeDialog, type FinalizeSettings } from '@/features/generation/components/FinalizeDialog';
import { ImageStudio } from '@/features/generation/components/ImageStudio';
import { VideoHistoryPanel } from '@/features/generation/components/VideoHistoryPanel';
import { VideoOutput } from '@/features/generation/components/VideoOutput';
import { useVideoHistory } from '@/features/generation/hooks/use-video-history';
import { useVideoJobs } from '@/features/generation/hooks/use-video-jobs';
import { calculateVideoCost } from '@/features/generation/utils/cost';
import { estimateVideoProgress } from '@/features/generation/utils/progress';
import { burnBrandingWatermarkIntoVideo, burnTitleOverlayIntoVideo } from '@/features/post-production/assembly/client';
import { useShortDramaProject } from '@/features/projects/hooks/use-short-drama-project';
import { useVideoMode } from '@/features/projects/hooks/use-video-mode';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import {
    DEFAULT_CAPTION_MODE,
    DEFAULT_TITLE_OVERLAY_DURATION,
    DEFAULT_TITLE_OVERLAY_LANGUAGE,
    DEFAULT_TITLE_OVERLAY_STYLE,
    DEFAULT_VOICE_LANGUAGE,
    SILENT_VOICE_LANGUAGE,
    cleanPromptForReuse,
    normalizeCaptionMode,
    normalizeTitleOverlayDuration,
    normalizeTitleOverlayLanguage,
    normalizeTitleOverlayStyle,
    normalizeTitleOverlayText,
    normalizeVoiceLanguage,
    promptWithLanguageControls
} from '@/features/script/prompt/guards';
import { AccountConnection } from '@/features/settings/components/AccountConnection';
import { ApiKeyDialog } from '@/features/settings/components/ApiKeyDialog';
import { ApiKeyGate } from '@/features/settings/components/ApiKeyGate';
import { useXcityKey } from '@/features/settings/hooks/use-xcity-key';
import { XCITY_SSO_ENABLED } from '@/features/settings/sso';
import { useAssetIdIntake } from '@/features/studio/hooks/use-asset-id-intake';
import { useStudioTabRouting } from '@/features/studio/hooks/use-studio-tab-routing';
import { studioVideoSharePath } from '@/features/studio/routing';
import { autoBindCharacterAssets } from './character-asset-autobind';
import { autoBindSceneAssets } from './scene-asset-autobind';
import { shotVideoPreviewsForProject } from './shot-video-previews';
import type { AppLocale } from '@/i18n/routing';
import { transcribeVideo, type CaptionSegment } from '@/lib/captions';
import {
    generateImages,
    loadImageModels,
    type GeneratedImage,
    type ImageModel,
    type ImageSizeId
} from '@/lib/image-service';
import {
    ArchiveSourceFetchError,
    archiveLocalVideo,
    archiveVideo,
    audioUrlToDataUri,
    createShare,
    deleteUserAsset,
    fetchArchivedVideo,
    fetchCommunityList,
    fetchCommunityQueue,
    fetchShare,
    imageUrlToDataUri,
    listUserAssets,
    portraitEnabled as loadPortraitEnabled,
    lookupArchivedVideo,
    mediaArchiveEnabled,
    mediaKeyFromUrl,
    mediaWorkerUrl,
    publishToCommunity,
    reviewCommunityItem,
    transcribeModel,
    ttsModel,
    uploadReferenceAudio,
    uploadReferenceImage,
    uploadReferenceVideo,
    type CommunityReviewAction,
    type UserAsset
} from '@/lib/media-archive';
import { optimizePrompt } from '@/lib/prompt-optimizer';
import { breakdownScript } from '@/lib/script-breakdown';
import { synthesizeSpeech, type TtsVoice } from '@/lib/tts';
import { VideoService } from '@/lib/video-service';
import {
    DEFAULT_MODEL,
    DEFAULT_RATIO,
    DEFAULT_RESOLUTION,
    DEFAULT_SECONDS,
    DEFAULT_VIDEO_REFERENCE_MODEL,
    clampSeconds,
    formatSize,
    getSeedanceModel,
    maxReferenceImages,
    modelSupportsFinalize,
    modelSupportsReferenceVideo,
    parseSize,
    type VideoModel,
    type VideoRatio,
    type VideoResolution
} from '@/shared/config/seedance';
import type { VideoJob, VideoJobCreate, VideoMetadata } from '@/shared/contracts/video';
import { InvalidApiKeyError, RealPersonImageError, sanitizeStudioErrorMessage } from '@/shared/errors';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type StudioWorkspaceProps = { locale: AppLocale };

export function StudioWorkspace({ locale }: StudioWorkspaceProps) {
    const t = useTranslations();
    const { activeTab, navigateToTab } = useStudioTabRouting(locale);
    const [videoMode] = useVideoMode();
    const [errorState, setErrorState] = React.useState<{ message: string; scope: ErrorScope } | null>(null);
    const setError = React.useCallback((message: string | null, scope: ErrorScope = 'create') => {
        setErrorState(message ? { message, scope } : null);
    }, []);
    const createError = errorState?.scope === 'create' ? errorState.message : null;
    const outputError = errorState?.scope === 'output' ? errorState.message : null;

    const [unresolvedPreviewIds, setUnresolvedPreviewIds] = React.useState<Set<string>>(new Set());
    const unresolvedPreviewIdsRef = React.useRef(unresolvedPreviewIds);
    unresolvedPreviewIdsRef.current = unresolvedPreviewIds;
    const [resolvingPreviewIds, setResolvingPreviewIds] = React.useState<Set<string>>(new Set());
    const markPreviewUnresolved = React.useCallback((id: string, unresolved: boolean) => {
        setUnresolvedPreviewIds((prev) => {
            if (prev.has(id) === unresolved) return prev;
            const next = new Set(prev);
            if (unresolved) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);
    const markPreviewResolving = React.useCallback((id: string, resolving: boolean) => {
        setResolvingPreviewIds((prev) => {
            if (prev.has(id) === resolving) return prev;
            const next = new Set(prev);
            if (resolving) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);
    const [extendPendingIds, setExtendPendingIds] = React.useState<Set<string>>(new Set());
    const markExtendPending = React.useCallback((id: string, pending: boolean) => {
        setExtendPendingIds((prev) => {
            if (prev.has(id) === pending) return prev;
            const next = new Set(prev);
            if (pending) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);
    const previewStateActionsRef = React.useRef({ markPreviewResolving, markPreviewUnresolved });
    previewStateActionsRef.current = { markPreviewResolving, markPreviewUnresolved };
    const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = React.useState(false);
    const [currentJobId, setCurrentJobId] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const approvedAuthorizationIds = React.useMemo<ReadonlySet<string>>(() => new Set(), []);
    const [createNotice, setCreateNotice] = React.useState<string | null>(null);
    const [shareNotice, setShareNotice] = React.useState<string | null>(null);
    const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
    const [shareDialogId, setShareDialogId] = React.useState('');
    const [shareDialogUrl, setShareDialogUrl] = React.useState('');
    const [shareDialogError, setShareDialogError] = React.useState<string | null>(null);
    const [sharingVideoId, setSharingVideoId] = React.useState<string | null>(null);
    const [shareUrlCopied, setShareUrlCopied] = React.useState(false);
    const [sharePlatformNotice, setSharePlatformNotice] = React.useState<string | null>(null);
    const [manualArchiveIds, setManualArchiveIds] = React.useState<Set<string>>(new Set());
    const regenerateReplacementRef = React.useRef<Map<string, VideoMetadata>>(new Map());
    const brandingRequestedIdsRef = React.useRef<Map<string, boolean>>(new Map());
    const brandingPendingIdsRef = React.useRef<Set<string>>(new Set());
    const brandedStoredIdsRef = React.useRef<Set<string>>(new Set());
    const fileSizeProbeIdsRef = React.useRef<Set<string>>(new Set());
    const watermarkQueueRef = React.useRef<WatermarkQueueItem[]>([]);
    const watermarkActiveIdRef = React.useRef<string | null>(null);
    const watermarkPendingIdsRef = React.useRef<Set<string>>(new Set());
    const [watermarkPendingIds, setWatermarkPendingIds] = React.useState<Set<string>>(new Set());
    const [watermarkActiveId, setWatermarkActiveId] = React.useState<string | null>(null);
    const [shareCommunityStatus, setShareCommunityStatus] = React.useState<'idle' | 'submitting' | 'submitted'>('idle');
    const [shareCommunityError, setShareCommunityError] = React.useState<string | null>(null);

    // Creation form state
    const [createModel, setCreateModel] = React.useState<VideoModel>(DEFAULT_MODEL);
    const [createPrompt, setCreatePrompt] = React.useState('');
    const [createRatio, setCreateRatio] = React.useState<VideoRatio>(DEFAULT_RATIO);
    const [createResolution, setCreateResolution] = React.useState<VideoResolution>(DEFAULT_RESOLUTION);
    const [createSeconds, setCreateSeconds] = React.useState<number>(DEFAULT_SECONDS);
    const [createVoiceLanguage, setCreateVoiceLanguage] = React.useState(DEFAULT_VOICE_LANGUAGE);
    const [createCaptionMode, setCreateCaptionMode] = React.useState(DEFAULT_CAPTION_MODE);
    const [createTitleOverlayEnabled, setCreateTitleOverlayEnabled] = React.useState(false);
    const [createTitleOverlayText, setCreateTitleOverlayText] = React.useState('');
    const [createTitleOverlayStyle, setCreateTitleOverlayStyle] = React.useState(DEFAULT_TITLE_OVERLAY_STYLE);
    const [createTitleOverlayDuration, setCreateTitleOverlayDuration] = React.useState(DEFAULT_TITLE_OVERLAY_DURATION);
    const [createTitleOverlayLanguage, setCreateTitleOverlayLanguage] = React.useState(DEFAULT_TITLE_OVERLAY_LANGUAGE);
    const [createCameraFixed, setCreateCameraFixed] = React.useState(false);
    const [createReferenceUrls, setCreateReferenceUrls] = React.useState<string[]>([]);
    const [createLastFrameUrl, setCreateLastFrameUrl] = React.useState('');
    const [createReferenceAudioUrl, setCreateReferenceAudioUrl] = React.useState('');
    const [createReferenceVideoUrls, setCreateReferenceVideoUrls] = React.useState<string[]>([]);
    const [createSeed, setCreateSeed] = React.useState<number | undefined>(undefined);
    const [createWatermark, setCreateWatermark] = React.useState(false);
    const [createWatermarkText, setCreateWatermarkText] = React.useState(BRANDING_WATERMARK_TEXT);
    const [finalizeDialogItem, setFinalizeDialogItem] = React.useState<VideoMetadata | null>(null);
    const [isFinalizeSubmitting, setIsFinalizeSubmitting] = React.useState(false);
    const [finalizeSubmitLabel, setFinalizeSubmitLabel] = React.useState('');
    const [imageAssets, setImageAssets] = React.useState<UserAsset[]>([]);
    const [isLoadingImageAssets, setIsLoadingImageAssets] = React.useState(false);

    const { apiKey, keyRef, ssoStatus, ssoError, attemptSso, resolveKey, saveManualKey, invalidateKey } = useXcityKey();
    const {
        history,
        characters,
        portraits,
        declarations,
        deletedIds,
        isInitialLoad,
        addItem,
        replaceItem,
        updateItem,
        removeItem,
        clearAll,
        syncNow,
        syncCloudNow,
        addCharacter,
        removeCharacter,
        addPortrait,
        findPortraitByUrl,
        removePortrait,
        setDeclaration
    } = useVideoHistory(resolveKey, {
        onPersistenceError: (message) => setError(message, 'output')
    });
    const projectDraft = useShortDramaProject();
    const [isShotBuilderOpen, setIsShotBuilderOpen] = React.useState(false);
    const { getVideoSrc, getThumbnailSrc, setRemoteSource, removeSource, clearAllSources, hasLocalCopy, hasSource } =
        useVideoSources();
    const previousVideoModeRef = React.useRef(videoMode);
    const activePortraits = React.useMemo(
        () => portraits.filter((portrait) => portrait.status === 'Active'),
        [portraits]
    );
    const effectiveDeclarations = React.useMemo(
        () => withPortraitDeclarations(declarations, activePortraits),
        [activePortraits, declarations]
    );

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

    React.useEffect(() => {
        const previousMode = previousVideoModeRef.current;
        previousVideoModeRef.current = videoMode;
        if (previousMode !== 'normal' || videoMode !== 'drama') return;

        setCurrentJobId(null);
        setError(null);
        setCreateNotice(null);
        setShareNotice(null);
        setIsShareDialogOpen(false);
        setShareDialogId('');
        setShareDialogUrl('');
        setShareDialogError(null);
        setSharingVideoId(null);
        setShareUrlCopied(false);
        setSharePlatformNotice(null);
        setShareCommunityStatus('idle');
        setShareCommunityError(null);
        setFinalizeDialogItem(null);
        setIsFinalizeSubmitting(false);
        setFinalizeSubmitLabel('');
        setIsShotBuilderOpen(false);
        setCreatePrompt('');
        setCreateRatio(DEFAULT_RATIO);
        setCreateResolution(DEFAULT_RESOLUTION);
        setCreateSeconds(DEFAULT_SECONDS);
        setCreateVoiceLanguage(DEFAULT_VOICE_LANGUAGE);
        setCreateCaptionMode(DEFAULT_CAPTION_MODE);
        setCreateTitleOverlayEnabled(false);
        setCreateTitleOverlayText('');
        setCreateTitleOverlayStyle(DEFAULT_TITLE_OVERLAY_STYLE);
        setCreateTitleOverlayDuration(DEFAULT_TITLE_OVERLAY_DURATION);
        setCreateTitleOverlayLanguage(DEFAULT_TITLE_OVERLAY_LANGUAGE);
        setCreateCameraFixed(false);
        setCreateReferenceUrls([]);
        setCreateLastFrameUrl('');
        setCreateReferenceAudioUrl('');
        setCreateReferenceVideoUrls([]);
        setCreateSeed(undefined);
        setCreateWatermark(false);
        setCreateWatermarkText(BRANDING_WATERMARK_TEXT);
    }, [setError, videoMode]);

    const handleDeclareReference = React.useCallback(
        (url: string, origin: ReferenceOrigin) => {
            const key = refKey(url);
            if (!key) return;
            const existing = declarations[key];
            const assetId = assetIdFromReferenceUrl(url);
            if (existing?.origin === origin && existing.assetId === assetId) return;
            setDeclaration(key, {
                ...(existing ?? {}),
                origin,
                declaredAt: Date.now(),
                ...(assetId ? { assetId } : {})
            });
        },
        [declarations, setDeclaration]
    );

    const handleAttachAssetId = useAssetIdIntake({
        createModel,
        setCreateModel,
        referenceUrls: createReferenceUrls,
        setReferenceUrls: setCreateReferenceUrls,
        declarations,
        setDeclaration,
        setNotice: setCreateNotice,
        setError
    });

    const handleAttachAssetIdToProject = React.useCallback(
        (input: { assetId: string; origin: ReferenceOrigin; note?: string }) => {
            const attached = handleAttachAssetId(input);
            return (
                attached &&
                Boolean(
                    projectDraft.registerProjectAsset({
                        name: input.note?.trim() || input.assetId,
                        kind: 'character',
                        sourceType: input.origin === 'official-asset' ? 'official' : 'provider',
                        status: 'active',
                        providerReferenceUrl: `asset://${input.assetId}`,
                        providerAssetId: input.assetId,
                        origin: input.origin,
                        note: input.note
                    })
                )
            );
        },
        [handleAttachAssetId, projectDraft]
    );

    const handleUpdateOfficialAssetNote = React.useCallback(
        (key: string, note: string) => {
            const existing = declarations[key];
            if (!existing || existing.origin !== 'official-asset') return;
            const nextNote = note.trim();
            const nextDeclaration = { ...existing };
            if (nextNote) nextDeclaration.note = nextNote;
            else delete nextDeclaration.note;
            setDeclaration(key, nextDeclaration);
        },
        [declarations, setDeclaration]
    );

    const creationFormRef = React.useRef<HTMLDivElement>(null);
    const scrollToCreationForm = React.useCallback(() => {
        return new Promise<void>((resolve) => {
            requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                    const target = creationFormRef.current;
                    if (target) {
                        const innerScroller = target.querySelector<HTMLElement>('[data-creation-form-scroll]');
                        innerScroller?.scrollTo({ top: 0, behavior: 'auto' });
                        window.scrollTo({
                            top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - 16),
                            behavior: 'smooth'
                        });
                    } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    resolve();
                })
            );
        });
    }, []);

    const applyPreset = React.useCallback(
        (item: GalleryItem) => {
            const p = reconcilePreset(item.params);
            const refs = p.reference_image_urls ?? (p.input_reference_url ? [p.input_reference_url] : []);
            setCreateModel(p.model);
            setCreatePrompt(p.prompt);
            setCreateRatio(p.ratio);
            setCreateResolution(p.resolution);
            setCreateSeconds(p.seconds);
            setCreateVoiceLanguage(
                normalizeVoiceLanguage(
                    p.voice_language ?? (p.generate_audio ? DEFAULT_VOICE_LANGUAGE : SILENT_VOICE_LANGUAGE)
                )
            );
            setCreateCaptionMode(normalizeCaptionMode(p.caption_mode));
            setCreateTitleOverlayEnabled(
                p.title_overlay_enabled === true && Boolean(normalizeTitleOverlayText(p.title_overlay_text))
            );
            setCreateTitleOverlayText(normalizeTitleOverlayText(p.title_overlay_text));
            setCreateTitleOverlayStyle(normalizeTitleOverlayStyle(p.title_overlay_style));
            setCreateTitleOverlayDuration(normalizeTitleOverlayDuration(p.title_overlay_duration));
            setCreateTitleOverlayLanguage(normalizeTitleOverlayLanguage(p.title_overlay_language));
            setCreateCameraFixed(p.camera_fixed ?? false);
            setCreateReferenceUrls(refs);
            setCreateLastFrameUrl(p.input_reference_url ? (p.last_frame_url ?? '') : '');
            setCreateReferenceAudioUrl(refs.length >= 2 ? (p.reference_audio_url ?? '') : '');
            setCreateReferenceVideoUrls((p.reference_video_urls ?? []).slice(0, MAX_REFERENCE_VIDEOS));
            setCreateSeed(p.seed);
            setCreateWatermark(p.watermark ?? false);
            setCreateWatermarkText(normalizeWatermarkText(p.watermarkText));
            setError(p.adjusted.length ? `Adjusted for ${p.model}: ${p.adjusted.join(', ')}` : null);
            scrollToCreationForm();
        },
        [scrollToCreationForm, setError]
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
                setCreateVoiceLanguage(normalizeVoiceLanguage(params.voice_language));
                setCreateCaptionMode(normalizeCaptionMode(params.caption_mode));
                setCreateTitleOverlayEnabled(
                    params.title_overlay_enabled === true && Boolean(params.title_overlay_text)
                );
                setCreateTitleOverlayText(normalizeTitleOverlayText(params.title_overlay_text));
                setCreateTitleOverlayStyle(normalizeTitleOverlayStyle(params.title_overlay_style));
                setCreateTitleOverlayDuration(normalizeTitleOverlayDuration(params.title_overlay_duration));
                setCreateTitleOverlayLanguage(normalizeTitleOverlayLanguage(params.title_overlay_language));
                setCreateCameraFixed(params.camera_fixed ?? false);
                setCreateReferenceUrls([]);
                setCreateLastFrameUrl('');
                setCreateReferenceAudioUrl('');
                setCreateReferenceVideoUrls([]);
                setCreateSeed(params.seed);
                setCreateWatermark(params.watermark ?? false);
                setCreateWatermarkText(normalizeWatermarkText(params.watermarkText));
                navigateToTab('video');
                setShareNotice('Loaded shared settings — generate to recreate');
                setError(adjusted.length ? `Adjusted shared settings: ${adjusted.join(', ')}` : null);
                scrollToCreationForm();
            } catch (err) {
                console.error('Error loading share:', err);
                setError(err instanceof Error ? err.message : 'Could not load shared settings.');
            }
        },
        [navigateToTab, scrollToCreationForm, setError]
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
            scrollToCreationForm();
        },
        [declareGeneratedReference, scrollToCreationForm]
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
    const [isVirtualPortraitEnabled, setIsVirtualPortraitEnabled] = React.useState(false);
    const [virtualCharacterGroups, setVirtualCharacterGroups] = React.useState<PortraitGroup[]>([]);
    const [imageModels, setImageModels] = React.useState<ImageModel[]>([]);
    React.useEffect(() => {
        void mediaArchiveEnabled().then(setUploadEnabled);
        void loadPortraitEnabled().then(setIsPortraitEnabled);
        void loadImageModels().then(setImageModels);
    }, []);
    const imageGenerationEnabled = imageModels.length > 0;
    const imageTabEnabled = imageGenerationEnabled || uploadEnabled;

    React.useEffect(() => {
        if (!isPortraitEnabled || !apiKey) {
            setIsVirtualPortraitEnabled(false);
            return;
        }

        let cancelled = false;
        void fetchPortraitStatus(apiKey)
            .then((status) => {
                if (!cancelled) setIsVirtualPortraitEnabled(Boolean(status.aigcOk));
            })
            .catch((err) => {
                console.warn('Could not check virtual portrait library:', err);
                if (!cancelled) setIsVirtualPortraitEnabled(false);
            });

        return () => {
            cancelled = true;
        };
    }, [apiKey, isPortraitEnabled]);

    const handleUploadImage = React.useCallback(
        async (file: File): Promise<string> => {
            const validation = await validateAssetImage(file);
            if (validation.status === 'rejected') {
                throw new Error(validation.message);
            }
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
                const validation = await validateAssetImage(file);
                if (validation.status === 'rejected') {
                    throw new Error(validation.message);
                }
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
            navigateToTab('video');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [declareGeneratedReference, navigateToTab, resolveKey]
    );

    const handleLoadAssets = React.useCallback(async () => {
        if (!uploadEnabled) return [];
        const key = await resolveKey();
        if (!key) {
            throw new Error('Sign in at xcity.ai (or set an API key) to view your assets.');
        }
        return listUserAssets(key);
    }, [resolveKey, uploadEnabled]);

    const refreshImageAssets = React.useCallback(async () => {
        if (!uploadEnabled) {
            setImageAssets([]);
            return;
        }
        setIsLoadingImageAssets(true);
        try {
            const assets = await handleLoadAssets();
            setImageAssets(assets.filter((asset) => asset.kind === 'image'));
        } catch (err) {
            console.warn('Could not load image assets:', err);
            setImageAssets([]);
        } finally {
            setIsLoadingImageAssets(false);
        }
    }, [handleLoadAssets, uploadEnabled]);

    React.useEffect(() => {
        if (!finalizeDialogItem) return;
        void refreshImageAssets();
    }, [finalizeDialogItem, refreshImageAssets]);

    React.useEffect(() => {
        if (activeTab !== 'image') return;
        const refreshTimer = window.setTimeout(() => void refreshImageAssets(), 0);
        return () => window.clearTimeout(refreshTimer);
    }, [activeTab, refreshImageAssets]);

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

    React.useEffect(() => {
        if (activeTab !== 'video' || !isPortraitEnabled) return;

        let cancelled = false;
        void (async () => {
            const key = await resolveKey();
            if (!key) {
                if (!cancelled) setVirtualCharacterGroups([]);
                return;
            }

            const groups = (await listPortraitGroups(key, 'aigc')).groups;
            if (!cancelled) setVirtualCharacterGroups(groups);
        })().catch((err) => {
            if (
                err instanceof Error &&
                err.message.toLowerCase().includes('authentication failed')
            ) {
                if (!cancelled) setVirtualCharacterGroups([]);
                return;
            }
            console.warn('Could not load virtual character groups:', err);
            if (!cancelled) setVirtualCharacterGroups([]);
        });

        return () => {
            cancelled = true;
        };
    }, [activeTab, isPortraitEnabled, resolveKey]);

    const handleLoadPortraitAssets = React.useCallback(
        async (type?: PortraitGroupQueryType) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) to view BytePlus assets.');
            }
            return (await listPortraitAssets(key, type)).assets;
        },
        [resolveKey]
    );

    const handleCreatePortraitGroup = React.useCallback(
        async (name: string) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) before creating a virtual character.');
            }
            const result = await createPortraitGroup(name, key);
            projectDraft.createCharacterReferencePack(name, [], result.groupId);
            return result;
        },
        [projectDraft, resolveKey]
    );

    const handleDeletePortraitGroup = React.useCallback(
        async (groupId: string) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) before deleting a character group.');
            }
            await deletePortraitGroup(groupId, key);
        },
        [resolveKey]
    );

    const handleCreatePortraitAsset = React.useCallback(
        async (input: { groupId: string; url: string; name: string; assetType?: 'Image' | 'Video' | 'Audio' }) => {
            const key = await resolveKey();
            if (!key) {
                throw new Error('Sign in at xcity.ai (or set an API key) before adding a portrait image.');
            }
            const result = await createPortraitAsset(input, key);
            projectDraft.registerProjectAsset({
                name: input.name,
                kind: 'character',
                sourceType: 'provider',
                status: 'reviewing',
                sourceUrl: input.url,
                providerReferenceUrl: `asset://${result.assetId}`,
                providerAssetId: result.assetId
            });
            return result;
        },
        [projectDraft, resolveKey]
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

    const handleReviewReferenceAsset = useProviderAssetReview({
        enabled: isPortraitEnabled,
        declarations,
        syncCloudNow,
        syncNow,
        findAssetByUrl: findPortraitByUrl,
        saveAsset: addPortrait,
        setDeclaration,
        createGroup: handleCreatePortraitGroup,
        createAsset: handleCreatePortraitAsset,
        getAsset: handleGetPortraitAsset
    });

    const handleAutoBindSceneAssets = React.useCallback(async (draft: EditorDraft, onProgress?: (draft: EditorDraft, progress: SceneAssetBindingProgress) => void, options?: AssetBindingOptions): Promise<EditorDraft> => {
            const imageModel = imageModels[0]?.id;
            if (!imageModel) throw new Error('Image generation is not configured.');
            if (!isPortraitEnabled) throw new Error('Asset review is not configured.');
            const nextDraft = await autoBindSceneAssets({
                draft, imageAssets, imageModel, ratio: createRatio, uploadEnabled,
                basePrompt: projectDraft.activeProject.basePrompt, styleNote: projectDraft.activeProject.styleNote,
                loadImageAssets: handleLoadAssets, generateImages: handleGenerateImages,
                reviewAsset: handleReviewReferenceAsset, resolveKey, onProgress, options
            });
            void refreshImageAssets();
            return nextDraft;
        }, [
            createRatio, handleGenerateImages, handleLoadAssets, handleReviewReferenceAsset, imageAssets,
            imageModels, isPortraitEnabled, projectDraft.activeProject.basePrompt,
            projectDraft.activeProject.styleNote, refreshImageAssets, resolveKey, uploadEnabled
        ]);

    const handleAutoBindCharacterAssets = React.useCallback(async (draft: EditorDraft, onProgress?: (draft: EditorDraft, progress: SceneAssetBindingProgress) => void, options?: AssetBindingOptions): Promise<EditorDraft> => {
            const imageModel = imageModels[0]?.id;
            if (!imageModel) throw new Error('Image generation is not configured.');
            if (!isPortraitEnabled) throw new Error('Asset review is not configured.');
            const nextDraft = await autoBindCharacterAssets({
                draft, imageAssets, imageModel, uploadEnabled,
                basePrompt: projectDraft.activeProject.basePrompt, styleNote: projectDraft.activeProject.styleNote,
                loadImageAssets: handleLoadAssets, generateImages: handleGenerateImages,
                reviewAsset: handleReviewReferenceAsset, resolveKey, onProgress, options
            });
            void refreshImageAssets();
            return nextDraft;
        }, [
            handleGenerateImages, handleLoadAssets, handleReviewReferenceAsset, imageAssets,
            imageModels, isPortraitEnabled, projectDraft.activeProject.basePrompt,
            projectDraft.activeProject.styleNote, refreshImageAssets, resolveKey, uploadEnabled
        ]);

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
        async (url: string, approvedReferenceUrl?: string, options?: ReferenceUseOptions) => {
            const refCap = maxReferenceImages(createModel);
            const stayOnAssets = Boolean(options?.stayOnAssets);
            if (createReferenceUrls.includes(url)) {
                setCreateNotice(null);
                setError('Reference image is already attached.', 'create');
            } else if (createReferenceUrls.length >= refCap) {
                setCreateNotice(null);
                setError(`Reference image limit reached (${refCap}). Remove one before adding another.`, 'create');
            } else {
                const validation = await validateAssetImage(url);
                if (validation.status === 'rejected') {
                    setCreateNotice(null);
                    setError(validation.message, 'create');
                    if (!stayOnAssets) {
                        navigateToTab('video');
                        void scrollToCreationForm();
                    }
                    return;
                }
                setCreateReferenceUrls((prev) => (prev.includes(url) ? prev : [...prev, url].slice(0, refCap)));
                const assetId = approvedReferenceUrl ? assetIdFromReferenceUrl(approvedReferenceUrl) : undefined;
                const key = refKey(url);
                if (assetId && key) {
                    const approvedDeclaration = effectiveDeclarations[refKey(approvedReferenceUrl ?? '')];
                    setDeclaration(key, {
                        ...(approvedDeclaration ??
                            declarations[key] ?? { origin: 'no-person', declaredAt: Date.now() }),
                        assetId
                    });
                }
                setError(null, 'create');
                setCreateNotice('Added as reference image.');
            }
            if (!stayOnAssets) {
                navigateToTab('video');
                void scrollToCreationForm();
            }
        },
        [
            createModel,
            createReferenceUrls,
            declarations,
            effectiveDeclarations,
            navigateToTab,
            scrollToCreationForm,
            setDeclaration,
            setError
        ]
    );

    /** Assets tab -> video form: append the video to the reference video list. */
    const handleUseAssetAsReferenceVideo = React.useCallback(
        (url: string, approvedReferenceUrl?: string) => {
            const switchesModel = !modelSupportsReferenceVideo(createModel);
            if (createReferenceVideoUrls.includes(url)) {
                setCreateNotice(null);
                setError('Reference video is already attached.', 'create');
            } else if (createReferenceVideoUrls.length >= MAX_REFERENCE_VIDEOS) {
                setCreateNotice(null);
                setError(
                    `Reference video limit reached (${MAX_REFERENCE_VIDEOS}). Remove one before adding another.`,
                    'create'
                );
            } else {
                if (switchesModel) {
                    setCreateModel(DEFAULT_VIDEO_REFERENCE_MODEL);
                }
                setCreateReferenceVideoUrls((prev) =>
                    prev.includes(url) ? prev : [...prev, url].slice(0, MAX_REFERENCE_VIDEOS)
                );
                const assetId = approvedReferenceUrl ? assetIdFromReferenceUrl(approvedReferenceUrl) : undefined;
                const key = refKey(url);
                if (assetId && key) {
                    const approvedDeclaration = effectiveDeclarations[refKey(approvedReferenceUrl ?? '')];
                    setDeclaration(key, {
                        ...(approvedDeclaration ??
                            declarations[key] ?? { origin: 'no-person', declaredAt: Date.now() }),
                        assetId
                    });
                }
                setError(null, 'create');
                setCreateNotice(
                    switchesModel
                        ? 'Added as reference video and switched to Seedance 2.5.'
                        : 'Added as reference video.'
                );
            }
            navigateToTab('video');
            void scrollToCreationForm();
        },
        [
            createModel,
            createReferenceVideoUrls,
            declarations,
            effectiveDeclarations,
            navigateToTab,
            scrollToCreationForm,
            setDeclaration,
            setError
        ]
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

    const handleBreakdownScript = React.useCallback(
        async (script: string) => {
            const key = await resolveKey();
            if (!key) {
                setIsApiKeyDialogOpen(true);
                throw new Error('Sign in at xcity.ai (or set an API key) to use script breakdown.');
            }
            try {
                return await breakdownScript(script, key, projectDraft.activeProject.sourceLanguage);
            } catch (error) {
                if (error instanceof InvalidApiKeyError) {
                    invalidateKey();
                    setIsApiKeyDialogOpen(true);
                }
                throw error;
            }
        },
        [invalidateKey, projectDraft.activeProject.sourceLanguage, resolveKey]
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

    const resolveArchivedPlayback = React.useCallback(
        async (videoId: string): Promise<boolean> => {
            const key = await resolveKey();
            if (!key) return false;

            const historyItem = history.find((item) => item.id === videoId);
            const shouldPreferBranded =
                brandingRequestedIdsRef.current.get(videoId) ??
                historyItem?.brandingWatermark?.enabled ??
                Boolean(historyItem?.createParams?.watermark);
            const watermarkText = normalizeWatermarkText(
                historyItem?.brandingWatermark?.text ?? historyItem?.createParams?.watermarkText
            );
            const archived =
                shouldPreferBranded && historyItem?.brandingWatermark?.watermarkedUrl
                    ? { url: historyItem.brandingWatermark.watermarkedUrl }
                    : shouldPreferBranded
                      ? ((await fetchArchivedVideo(watermarkedVideoId(videoId, watermarkText), key)) ??
                        (await fetchArchivedVideo(legacyWatermarkedVideoId(videoId), key)) ??
                        (await fetchArchivedVideo(videoId, key)))
                      : await fetchArchivedVideo(videoId, key);
            if (!archived) return false;

            setRemoteSource(videoId, archived.url);
            markPreviewUnresolved(videoId, false);
            markPreviewResolving(videoId, false);
            updateItem(videoId, { storedUrl: archived.url, mediaExpired: false });
            return true;
        },
        [history, markPreviewResolving, markPreviewUnresolved, resolveKey, setRemoteSource, updateItem]
    );

    /** Finalizes a finished video, archives it to R2, then caches locally best-effort. */
    const downloadAndStoreVideo = React.useCallback(
        async (job: VideoJob): Promise<boolean> => {
            console.log(`Downloading video for job: ${job.id}`);
            markPreviewResolving(job.id, true);

            if (await resolveArchivedPlayback(job.id)) {
                updateItem(job.id, {
                    durationMs: Date.now() - job.created_at * 1000,
                    storageModeUsed: 'r2',
                    status: 'completed'
                });
                return true;
            }

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
                    sourceUrl = (await videoService.retrieveVideo(job.id, { force: true })).output_url;
                } catch (err) {
                    console.warn(`Could not re-read output_url for ${job.id}:`, err);
                }
            }

            // Register the CDN link first as a short-lived playback fallback.
            // The durable path is Worker -> R2; IndexedDB caching below is
            // best-effort and must not decide whether the job is completed.
            if (sourceUrl) {
                setRemoteSource(job.id, sourceUrl);
                updateItem(job.id, { providerUrl: sourceUrl });
                markPreviewResolving(job.id, false);
            } else {
                markPreviewResolving(job.id, false);
                markPreviewUnresolved(job.id, true);
                setError(
                    `The gateway reported the video as completed but has not exposed its playback link yet (job ${job.id}). ` +
                        'Use Retry in a moment, or select it from History to probe again.',
                    'output'
                );
                return false;
            }

            updateItem(job.id, {
                durationMs: Date.now() - job.created_at * 1000,
                providerUrl: sourceUrl,
                status: 'completed',
                mediaExpired: false
            });

            try {
                const blob = await videoService.downloadContent(job.id, sourceUrl);
                updateItem(job.id, { fileSizeBytes: blob.size });
                const historyItem = history.find((item) => item.id === job.id);
                const shouldAddBranding =
                    brandingRequestedIdsRef.current.get(job.id) ??
                    historyItem?.brandingWatermark?.enabled ??
                    Boolean(historyItem?.createParams?.watermark);
                const watermarkText = normalizeWatermarkText(
                    historyItem?.brandingWatermark?.text ?? historyItem?.createParams?.watermarkText
                );
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

                let originalArchiveUrl: string | undefined;
                let titledArchiveUrl: string | undefined;
                let watermarkedArchiveUrl: string | undefined;
                let brandedBlob: Blob | null = null;
                let processedBlob = blob;
                const titleOverlayText = normalizeTitleOverlayText(historyItem?.createParams?.title_overlay_text);
                const shouldAddTitleOverlay =
                    historyItem?.createParams?.title_overlay_enabled === true && Boolean(titleOverlayText);

                if (shouldAddTitleOverlay) {
                    try {
                        console.log(`[title-overlay] adding opening title to ${job.id}`);
                        processedBlob = await burnTitleOverlayIntoVideo(
                            processedBlob,
                            {
                                text: titleOverlayText,
                                style: historyItem?.createParams?.title_overlay_style,
                                duration: historyItem?.createParams?.title_overlay_duration
                            },
                            (progress) => {
                                if (progress === 0 || progress === 1) {
                                    console.log(`[title-overlay] ${job.id} ${Math.round(progress * 100)}%`);
                                }
                            }
                        );
                        await db.videos.put({
                            id: job.id,
                            filename: `${job.id}.mp4`,
                            blob: processedBlob,
                            thumbnail: thumbnailBlob,
                            created_at: job.created_at
                        });
                    } catch (err) {
                        console.warn(`Could not add opening title to ${job.id}; keeping provider video.`, err);
                    }
                }

                try {
                    const key = await resolveKey();
                    if (key) {
                        const assetName = historyItem?.title?.trim() || job.id;
                        const archivedOriginal = await archiveLocalVideo(job.id, blob, key, `${assetName}.mp4`);
                        if (archivedOriginal?.url) {
                            originalArchiveUrl = archivedOriginal.url;
                            if (!shouldAddBranding) {
                                setRemoteSource(job.id, archivedOriginal.url);
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`Could not archive original video ${job.id} to R2.`, err);
                }

                if (shouldAddTitleOverlay && processedBlob !== blob) {
                    try {
                        const key = await resolveKey();
                        if (key) {
                            const archiveId = `${job.id}_title`;
                            const archived = await archiveLocalVideo(archiveId, processedBlob, key, `${archiveId}.mp4`);
                            if (archived?.url) {
                                titledArchiveUrl = archived.url;
                                if (!shouldAddBranding) {
                                    setRemoteSource(job.id, archived.url);
                                }
                            }
                        }
                    } catch (err) {
                        console.warn(`Could not archive titled video ${job.id} to R2.`, err);
                    }
                }

                if (shouldAddBranding) {
                    try {
                        console.log(`[branding] adding watermark to ${job.id}`);
                        brandedBlob = await burnBrandingWatermarkIntoVideo(processedBlob, watermarkText, (progress) => {
                            if (progress === 0 || progress === 1) {
                                console.log(`[branding] ${job.id} ${Math.round(progress * 100)}%`);
                            }
                        });
                        await db.videos.put({
                            id: job.id,
                            filename: `${job.id}.mp4`,
                            blob: brandedBlob,
                            thumbnail: thumbnailBlob,
                            created_at: job.created_at
                        });
                        console.log(`[branding] stored local watermarked video for ${job.id}`);
                    } catch (err) {
                        console.warn(`Could not add branding watermark to ${job.id}; keeping original video.`, err);
                    }
                }

                if (brandedBlob) {
                    try {
                        const key = await resolveKey();
                        if (key) {
                            const archiveId = watermarkedVideoId(job.id, watermarkText);
                            const archived = await archiveLocalVideo(archiveId, brandedBlob, key, `${archiveId}.mp4`);
                            if (archived?.url) {
                                watermarkedArchiveUrl = archived.url;
                                brandedStoredIdsRef.current.add(job.id);
                                setRemoteSource(job.id, archived.url);
                            }
                        }
                    } catch (err) {
                        console.warn(`Could not archive watermarked video ${job.id} to R2.`, err);
                    }
                }

                const storedUrl = watermarkedArchiveUrl ?? titledArchiveUrl ?? originalArchiveUrl;
                const brandingEnabled = Boolean(watermarkedArchiveUrl || (brandedBlob && !storedUrl));
                if (!watermarkedArchiveUrl && (titledArchiveUrl || originalArchiveUrl)) {
                    setRemoteSource(job.id, titledArchiveUrl ?? originalArchiveUrl!);
                }
                updateItem(job.id, {
                    durationMs: Date.now() - job.created_at * 1000,
                    fileSizeBytes: brandedBlob?.size ?? processedBlob.size,
                    storageModeUsed: storedUrl ? 'r2' : 'indexeddb',
                    status: 'completed',
                    ...(storedUrl ? { storedUrl, mediaExpired: false } : {}),
                    brandingWatermark: {
                        enabled: brandingEnabled,
                        text: watermarkText,
                        ...(originalArchiveUrl ? { originalUrl: originalArchiveUrl } : {}),
                        ...(watermarkedArchiveUrl ? { watermarkedUrl: watermarkedArchiveUrl } : {})
                    }
                });
                if (storedUrl) {
                    markPreviewUnresolved(job.id, false);
                    await syncNow();
                    await db.videos.where('id').equals(job.id).delete();
                    console.log(`[media-cache] removed local cached video for ${job.id}; using R2 playback`);
                }
                console.log(`Video ${job.id} finalized`);
            } catch (err) {
                if (err instanceof InvalidApiKeyError) {
                    handleInvalidApiKey();
                    return false;
                }
                console.warn(`Could not cache video ${job.id} locally; playback will use the remote source.`, err);
            }

            return true;
        },
        [
            resolveKey,
            history,
            videoService,
            setRemoteSource,
            updateItem,
            handleInvalidApiKey,
            markPreviewResolving,
            markPreviewUnresolved,
            resolveArchivedPlayback,
            setError,
            syncNow
        ]
    );

    const archivedKeysForItem = React.useCallback(
        async (item: Pick<VideoMetadata, 'id' | 'storedUrl' | 'brandingWatermark'>, key: string) => {
            const keys = new Set<string>();
            if (item.storedUrl) {
                const storedKey = mediaKeyFromUrl(item.storedUrl);
                if (storedKey) keys.add(storedKey);
            }
            if (item.brandingWatermark?.originalUrl) {
                const originalKey = mediaKeyFromUrl(item.brandingWatermark.originalUrl);
                if (originalKey) keys.add(originalKey);
            }
            if (item.brandingWatermark?.watermarkedUrl) {
                const watermarkedKey = mediaKeyFromUrl(item.brandingWatermark.watermarkedUrl);
                if (watermarkedKey) keys.add(watermarkedKey);
            }

            if (!keys.size) {
                let archived = await lookupArchivedVideo(
                    watermarkedVideoId(item.id, item.brandingWatermark?.text ?? BRANDING_WATERMARK_TEXT),
                    key
                );
                if (archived.status !== 'found') {
                    archived = await lookupArchivedVideo(legacyWatermarkedVideoId(item.id), key);
                }
                if (archived.status !== 'found') {
                    archived = await lookupArchivedVideo(item.id, key);
                }
                if (archived.status === 'found') {
                    const archivedKey = archived.media.key ?? mediaKeyFromUrl(archived.media.url);
                    if (archivedKey) keys.add(archivedKey);
                }
            }

            return keys;
        },
        []
    );

    const protectedArchiveKeysForVideo = React.useCallback(
        async (id: string) => {
            const key = await resolveKey();
            if (!key) return new Set<string>();
            return archivedKeysForItem({ id }, key);
        },
        [archivedKeysForItem, resolveKey]
    );

    const deleteCloudCopyForItem = React.useCallback(
        async (item: VideoMetadata, protectedKeys: Set<string> = new Set()) => {
            const key = await resolveKey();
            if (!key) return;

            const keys = await archivedKeysForItem(item, key);
            for (const protectedKey of protectedKeys) keys.delete(protectedKey);

            await Promise.all(Array.from(keys).map((assetKey) => deleteUserAsset(assetKey, key)));
        },
        [archivedKeysForItem, resolveKey]
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
                brandingPendingIdsRef.current.add(job.id);
                const historyItem = history.find((item) => item.id === job.id);
                const completedSeconds = Number(job.seconds);
                const actualSeconds =
                    Number.isFinite(completedSeconds) && completedSeconds > 0 ? completedSeconds : undefined;
                const createParams =
                    historyItem?.createParams && (historyItem.createParams.seed === undefined || actualSeconds)
                        ? {
                              ...historyItem.createParams,
                              ...(typeof job.seed === 'number' && historyItem.createParams.seed === undefined
                                  ? { seed: job.seed }
                                  : {}),
                              ...(actualSeconds ? { seconds: actualSeconds } : {})
                          }
                        : undefined;
                const completedCostDetails =
                    createParams && actualSeconds
                        ? calculateVideoCost({
                              model: createParams.model,
                              ratio: createParams.ratio,
                              resolution: createParams.resolution,
                              seconds: actualSeconds,
                              generateAudio: createParams.generate_audio,
                              inputVideoSeconds: inputVideoSecondsFromParams(createParams)
                          })
                        : undefined;
                updateItem(job.id, {
                    progress: 100,
                    status: 'completed',
                    ...(actualSeconds ? { seconds: actualSeconds } : {}),
                    ...(createParams ? { createParams } : {}),
                    ...(completedCostDetails !== undefined ? { costDetails: completedCostDetails } : {})
                });
                const refReplacedItem = regenerateReplacementRef.current.get(job.id);
                const replacesId = refReplacedItem?.id ?? historyItem?.replacesId;
                const replacedItem =
                    refReplacedItem ?? (replacesId ? history.find((item) => item.id === replacesId) : undefined);
                void (async () => {
                    console.log('video completed', job);
                    let hasPlaybackSource = false;
                    try {
                        hasPlaybackSource = await downloadAndStoreVideo(job);
                    } finally {
                        brandingRequestedIdsRef.current.delete(job.id);
                        brandingPendingIdsRef.current.delete(job.id);
                    }
                    console.log('hasPlaybackSource', hasPlaybackSource);
                    if (!replacedItem || !hasPlaybackSource) return;
                    regenerateReplacementRef.current.delete(job.id);

                    const protectedKeys = await protectedArchiveKeysForVideo(job.id);
                    await deleteCloudCopyForItem(replacedItem, protectedKeys).catch((err) => {
                        console.warn(`Could not delete replaced cloud copy for ${replacedItem.id}:`, err);
                    });
                    await db.videos.where('id').equals(replacedItem.id).delete();
                    removeSource(replacedItem.id);
                    removeItem(replacedItem.id);
                    updateItem(job.id, { replacesId: undefined });
                    console.log('currentJobId === replacedItem.id', currentJobId, replacedItem.id);
                    if (currentJobId === replacedItem.id) setCurrentJobId(job.id);
                    console.log('syncNow job', job);
                    await syncNow();
                })();
            },
            onFailed: (job: VideoJob) => {
                brandingRequestedIdsRef.current.delete(job.id);
                brandingPendingIdsRef.current.delete(job.id);
                regenerateReplacementRef.current.delete(job.id);
                updateItem(job.id, {
                    status: 'failed',
                    costDetails: null,
                    error: sanitizeStudioErrorMessage(job.error?.message || 'Video generation failed')
                });
                setError(sanitizeStudioErrorMessage(job.error?.message || 'Video generation failed'), 'output');
            },
            onInvalidKey: () => handleInvalidApiKey()
        }),
        [
            history,
            updateItem,
            deleteCloudCopyForItem,
            protectedArchiveKeysForVideo,
            removeSource,
            removeItem,
            currentJobId,
            downloadAndStoreVideo,
            handleInvalidApiKey,
            setError,
            syncNow
        ]
    );

    const { activeJobs, addJob, replaceJob, removeJob, restoreJobs, clearJobs } = useVideoJobs(
        videoService,
        jobCallbacks
    );

    React.useEffect(() => {
        const hasRunningJob = Array.from(activeJobs.values()).some(
            (job) => job.status === 'queued' || job.status === 'in_progress'
        );
        if (!isSubmitting && !hasRunningJob) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [activeJobs, isSubmitting]);

    // Permanent R2 copies for completed videos (see hook for the why).
    const { retryArchive } = useMediaArchive({
        history,
        enabled: !isInitialLoad,
        service: videoService,
        resolveKey,
        onArchived: (id, url, bytes) => {
            if (brandedStoredIdsRef.current.has(id)) return;
            if (brandingPendingIdsRef.current.has(id)) return;
            setRemoteSource(id, url);
            markPreviewUnresolved(id, false);
            markPreviewResolving(id, false);
            updateItem(id, {
                storedUrl: url,
                storageModeUsed: 'r2',
                status: 'completed',
                progress: 100,
                ...(bytes !== null ? { fileSizeBytes: bytes } : {}),
                mediaExpired: false
            });
            void syncNow();
        },
        onExpired: (id) => {
            if (brandingPendingIdsRef.current.has(id)) return;
            const item = history.find((candidate) => candidate.id === id);
            if (!item || item.storedUrl || hasLocalCopy(id)) return;
            updateItem(id, { mediaExpired: true });
        }
    });

    const replacementCleanupIdsRef = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        if (isInitialLoad) return;

        for (const item of history) {
            if (item.status !== 'completed') continue;
            if (replacementCleanupIdsRef.current.has(item.id)) continue;

            const replacedItem = item.replacesId
                ? history.find((candidate) => candidate.id === item.replacesId)
                : undefined;

            const itemsToRemove = new Map<string, VideoMetadata>();
            if (replacedItem) itemsToRemove.set(replacedItem.id, replacedItem);

            if (!itemsToRemove.size) {
                if (item.replacesId) updateItem(item.id, { replacesId: undefined });
                continue;
            }

            const newVideoHasPlayback =
                Boolean(item.storedUrl || item.providerUrl) || hasLocalCopy(item.id) || hasSource(item.id);
            if (!newVideoHasPlayback) continue;

            replacementCleanupIdsRef.current.add(item.id);
            void (async () => {
                try {
                    if (!item.storedUrl) retryArchive(item.id);
                    const protectedKeys = await protectedArchiveKeysForVideo(item.id);
                    for (const oldItem of itemsToRemove.values()) {
                        await deleteCloudCopyForItem(oldItem, protectedKeys).catch((err) => {
                            console.warn(`Could not delete replaced cloud copy for ${oldItem.id}:`, err);
                        });
                        await db.videos.where('id').equals(oldItem.id).delete();
                        removeSource(oldItem.id);
                        removeItem(oldItem.id);
                    }
                    updateItem(item.id, { replacesId: undefined });
                    if (Array.from(itemsToRemove.keys()).includes(currentJobId ?? '')) setCurrentJobId(item.id);
                    await syncNow();
                } finally {
                    replacementCleanupIdsRef.current.delete(item.id);
                }
            })();
        }
    }, [
        currentJobId,
        deleteCloudCopyForItem,
        hasLocalCopy,
        hasSource,
        history,
        isInitialLoad,
        removeItem,
        removeSource,
        protectedArchiveKeysForVideo,
        retryArchive,
        syncNow,
        updateItem
    ]);

    usePosterBackfill({
        history,
        enabled: !isInitialLoad
    });

    React.useEffect(() => {
        if (isInitialLoad) return;
        const candidates = history
            .filter(
                (item) =>
                    item.storedUrl &&
                    !item.fileSizeBytes &&
                    item.status === 'completed' &&
                    !fileSizeProbeIdsRef.current.has(item.id)
            )
            .slice(0, 6);
        if (!candidates.length) return;

        let cancelled = false;
        for (const item of candidates) {
            fileSizeProbeIdsRef.current.add(item.id);
            void fetchVideoContentLength(item.storedUrl!).then((bytes) => {
                if (cancelled || bytes === null) return;
                updateItem(item.id, { fileSizeBytes: bytes });
            });
        }

        return () => {
            cancelled = true;
        };
    }, [history, isInitialLoad, updateItem]);

    const blockedReferencesForParams = React.useCallback(
        (params: VideoJobCreate): string[] =>
            imageReferenceUrlsFromParams(params).filter((url) => {
                const declaration = effectiveDeclarations[refKey(url)];
                if (!declarationSatisfied(declaration, approvedAuthorizationIds)) return true;
                return maxReferenceImages(params.model) <= 1 && referenceRequiresAssetLibrary(url, declaration);
            }),
        [approvedAuthorizationIds, effectiveDeclarations]
    );

    const firstReferenceBlockReason = React.useCallback(
        (model: VideoModel, urls: string[]): string | null => {
            const first = urls[0];
            if (!first) return null;
            const declaration = effectiveDeclarations[refKey(first)];
            if (maxReferenceImages(model) <= 1 && referenceRequiresAssetLibrary(first, declaration)) {
                return ASSET_LIBRARY_MODEL_BLOCK_REASON;
            }
            return declarationBlockReason(declaration, approvedAuthorizationIds);
        },
        [approvedAuthorizationIds, effectiveDeclarations]
    );

    // Repair local metadata when the browser already has the MP4 but the last
    // history write was interrupted before status flipped to completed.
    React.useEffect(() => {
        if (isInitialLoad) return;
        for (const item of history) {
            if (item.status === 'processing' && hasLocalCopy(item.id)) {
                updateItem(item.id, { status: 'completed', progress: 100, storageModeUsed: 'indexeddb' });
            }
        }
    }, [history, hasLocalCopy, isInitialLoad, updateItem]);

    // A submitting temp item is written before the provider returns a real job
    // id. If the page refreshes or the request chain aborts at that point, it
    // cannot be resumed and should not look like a real generation.
    const orphanSubmittingCleanupRef = React.useRef(false);
    React.useEffect(() => {
        if (isInitialLoad || orphanSubmittingCleanupRef.current) return;
        orphanSubmittingCleanupRef.current = true;

        const orphanItems = history.filter((item) => item.status === 'submitting' && item.id.startsWith('temp_'));
        if (!orphanItems.length) return;

        console.info(
            'Removing orphan submitting video placeholder(s):',
            orphanItems.map((item) => ({ id: item.id, finalizeFlag: item.finalizeFlag }))
        );
        for (const item of orphanItems) {
            removeJob(item.id);
            removeItem(item.id);
        }
    }, [history, isInitialLoad, removeItem, removeJob]);

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
    const handleCreateVideo = async (
        rawFormData: CreationFormData,
        options: {
            replacesItem?: VideoMetadata;
            replacesItemId?: string;
            title?: string;
            referenceVideoFallbackUrls?: string[];
            finalizeFlag?: 0 | 1 | 2;
            rethrowOnError?: boolean;
            onSubmitStage?: (message: string) => void;
        } = {}
    ): Promise<string | null> => {
        const replacementItem = options.replacesItem ?? (options.replacesItemId ? history.find((item) => item.id === options.replacesItemId) : undefined);
        const voiceLanguage = normalizeVoiceLanguage(
            rawFormData.voice_language ?? (rawFormData.generate_audio ? DEFAULT_VOICE_LANGUAGE : SILENT_VOICE_LANGUAGE)
        );
        const captionMode = normalizeCaptionMode(rawFormData.caption_mode);
        const titleOverlayText = normalizeTitleOverlayText(rawFormData.title_overlay_text);
        const titleOverlayEnabled = rawFormData.title_overlay_enabled === true && Boolean(titleOverlayText);
        const titleOverlayStyle = normalizeTitleOverlayStyle(rawFormData.title_overlay_style);
        const titleOverlayDuration = normalizeTitleOverlayDuration(rawFormData.title_overlay_duration);
        const titleOverlayLanguage = normalizeTitleOverlayLanguage(rawFormData.title_overlay_language);
        const formData: CreationFormData = {
            ...rawFormData,
            prompt: promptWithLanguageControls(rawFormData.prompt, {
                voiceLanguage,
                captionMode,
                titleOverlay: {
                    enabled: titleOverlayEnabled,
                    text: titleOverlayText,
                    style: titleOverlayStyle,
                    duration: titleOverlayDuration,
                    language: titleOverlayLanguage
                }
            }),
            generate_audio: voiceLanguage !== SILENT_VOICE_LANGUAGE,
            avoid_generated_captions: captionMode === 'none',
            generated_captions: undefined,
            generated_caption_languages: undefined,
            voice_language: voiceLanguage,
            caption_mode: captionMode,
            title_overlay_enabled: titleOverlayEnabled,
            title_overlay_text: titleOverlayEnabled ? titleOverlayText : undefined,
            title_overlay_style: titleOverlayStyle,
            title_overlay_duration: titleOverlayDuration,
            title_overlay_language: titleOverlayLanguage
        };
        setError(null);
        setCreateNotice(null);
        setShareNotice(null);
        const blockedReferences = blockedReferencesForParams(formData);
        if (blockedReferences.length > 0) {
            setError(
                firstReferenceBlockReason(formData.model, blockedReferences) ?? 'Choose where this image came from.'
            );
            return null;
        }
        setIsSubmitting(true);

        // Resolve the key at submit time — an SSO key that lands after this
        // handler's render is invisible to its closure, and keys rotate.
        options.onSubmitStage?.('Checking Xcity API key...');
        const activeKey = await resolveKey();
        if (!activeKey) {
            setError('Could not read your Xcity API key. Sign in at xcity.ai and retry.');
            setIsSubmitting(false);
            return null;
        }

        // The provider downloads every reference image server-side; a stale
        // link (e.g. an asset deleted after being added here) fails there as
        // an opaque "resource download failed". Our worker's URLs are
        // CORS-open, so verify those up front and name the broken image.
        options.onSubmitStage?.('Preparing reference media...');
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
        const providerDownloadUrl = (url: string): string => {
            if (!workerBase || isAssetReferenceUrl(url)) return url;
            try {
                const parsed = new URL(url);
                const worker = new URL(workerBase);
                if (parsed.origin !== worker.origin || !parsed.pathname.startsWith('/media/')) return url;
                const key = decodeURIComponent(parsed.pathname.slice('/media/'.length));
                const encodedKey = key.split('/').map(encodeURIComponent).join('/');
                return `${workerBase}/download/${encodedKey}`;
            } catch {
                return url;
            }
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
        if (formData.passthrough_reference_video_urls) {
            formData.passthrough_reference_video_urls = formData.passthrough_reference_video_urls.map(rebase);
        }

        // Ark's server-side fetcher cannot reliably download from
        // Cloudflare-fronted hosts, so inline image/audio references as Base64
        // data URIs when the browser can fetch them. Keep video-only reference
        // requests as URLs; the older multi-reference flow only inlined videos
        // when an image reference was also attached.
        const requestParams: CreationFormData = { ...formData, watermark: false, watermarkText: undefined };
        delete requestParams.passthrough_reference_video_urls;
        let totalChars = 0;
        const refUrls =
            formData.reference_image_urls ??
            (formData.input_reference_url
                ? [formData.input_reference_url, ...(formData.last_frame_url ? [formData.last_frame_url] : [])]
                : []);
        if (refUrls.length) {
            const inlined: string[] = [];
            for (let i = 0; i < refUrls.length; i++) {
                const url = providerReferenceUrl(refUrls[i], effectiveDeclarations);
                options.onSubmitStage?.(`Reading reference image ${i + 1}/${refUrls.length}...`);
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
                        return null;
                    }
                    // External host without CORS: pass the URL through and let
                    // the provider try fetching it directly.
                    inlined.push(url);
                    continue;
                }
                const validation = await validateAssetImage(dataUri);
                if (validation.status === 'rejected') {
                    setError(`Reference image ${i + 1}: ${validation.message}`);
                    setIsSubmitting(false);
                    return null;
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
            options.onSubmitStage?.('Reading reference audio...');
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
                    return null;
                }
            } else {
                totalChars += dataUri.length;
                requestParams.reference_audio_url = dataUri;
            }
        }
        if (formData.reference_video_urls?.length) {
            const providerVideoUrls = formData.reference_video_urls.map((url) =>
                providerReferenceUrl(url, effectiveDeclarations)
            );
            const invalidIndex = providerVideoUrls.findIndex(
                (url) => !isAssetReferenceUrl(url) && !isWebReferenceUrl(url)
            );
            if (invalidIndex !== -1) {
                setError(
                    `Reference video ${invalidIndex + 1} must be a public http(s) URL. Remove it and upload the video again.`
                );
                setIsSubmitting(false);
                return null;
            }
            requestParams.reference_video_urls = providerVideoUrls.map(providerDownloadUrl);
        }
        if (totalChars > 30_000_000) {
            setError('Reference media are too large to submit (over ~20 MB combined). Use fewer or smaller files.');
            setIsSubmitting(false);
            return null;
        }

        // Optimistic placeholder so the output panel reacts immediately.
        const displaySize = formatSize(formData.ratio, formData.resolution);
        const tempId = `temp_${Date.now()}`;
        const normalizedWatermarkText = normalizeWatermarkText(formData.watermarkText);
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
        addItem({
            id: tempId,
            timestamp: Date.now(),
            filename: `${tempId}.mp4`,
            storageModeUsed: 'indexeddb',
            durationMs: 0,
            model: formData.model,
            size: displaySize,
            seconds: formData.seconds,
            title: options.title?.trim() || replacementItem?.title?.trim() || undefined,
            prompt: formData.prompt,
            mode: 'create',
            createParams: { ...formData, watermarkText: normalizedWatermarkText },
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
            finalizeFlag: options.finalizeFlag,
            brandingWatermark: formData.watermark
                ? { enabled: true, text: normalizedWatermarkText }
                : { enabled: false },
            replacesId: replacementItem?.id,
            status: 'submitting',
            progress: 0
        });
        setCurrentJobId(tempId);
        try {
            const logReferenceVideoUrls = (label: string) => {
                if (process.env.NODE_ENV === 'production' || !requestParams.reference_video_urls?.length) return;
                console.info(
                    label,
                    requestParams.reference_video_urls.map((url) => summarizeWebUrl(url))
                );
            };
            logReferenceVideoUrls('Submitting reference video URLs:');
            options.onSubmitStage?.('Creating video job...');
            let result: VideoJob;
            try {
                result = await videoService.createVideo(requestParams);
            } catch (createError) {
                const fallbackUrl = options.referenceVideoFallbackUrls?.find(
                    (url) => !requestParams.reference_video_urls?.includes(url)
                );
                if (!fallbackUrl || !isReferenceVideoDownloadError(createError)) {
                    throw createError;
                }
                console.warn(
                    'Reference video URL download failed; retrying with fallback URL:',
                    summarizeWebUrl(fallbackUrl)
                );
                requestParams.reference_video_urls = [fallbackUrl];
                logReferenceVideoUrls('Retrying reference video URLs:');
                result = await videoService.createVideo(requestParams);
            }
            console.log('Video job created:', result.id);

            // Normalize gateway-shaped fields (size "16x9", seconds "5") to
            // the display values the form produced.
            const job: VideoJob = {
                ...result,
                prompt: formData.prompt,
                size: displaySize,
                seconds: String(formData.seconds)
            };
            if (replacementItem) {
                regenerateReplacementRef.current.set(job.id, replacementItem);
            }
            brandingRequestedIdsRef.current.set(job.id, Boolean(formData.watermark));
            const createParams =
                typeof job.seed === 'number' && formData.seed === undefined
                    ? { ...formData, seed: job.seed, watermarkText: normalizedWatermarkText }
                    : { ...formData, watermarkText: normalizedWatermarkText };

            replaceJob(tempId, job);
            setCurrentJobId(job.id);

            const historyItem: VideoMetadata = {
                id: job.id,
                timestamp: Date.now(),
                filename: `${job.id}.mp4`,
                storageModeUsed: 'indexeddb',
                durationMs: 0, // Set when complete
                model: job.model,
                size: job.size,
                seconds: formData.seconds,
                title: options.title?.trim() || replacementItem?.title?.trim() || undefined,
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
                finalizeFlag: options.finalizeFlag,
                brandingWatermark: formData.watermark
                    ? { enabled: true, text: normalizedWatermarkText }
                    : { enabled: false },
                replacesId: replacementItem?.id,
                status: 'processing',
                progress: 0
            };
            if (replacementItem) {
                removeItem(tempId);
                replaceItem(replacementItem.id, historyItem);
            } else {
                replaceItem(tempId, historyItem);
            }
            options.onSubmitStage?.('Saving video history...');
            await syncNow();

            if (job.status === 'completed') {
                queueMicrotask(() => jobCallbacks.onCompleted(job));
            } else if (job.status === 'failed') {
                queueMicrotask(() => jobCallbacks.onFailed(job));
            }
            return job.id;
        } catch (err: unknown) {
            // This failure is handled below and rendered in VideoOutput. Passing
            // the Error object to console.error makes Next.js dev treat it as an
            // unhandled exception and cover the Studio with its error overlay.
            console.warn(
                'Video creation failed:',
                err instanceof Error ? sanitizeStudioErrorMessage(err.message) : 'An unexpected error occurred.'
            );
            if (err instanceof InvalidApiKeyError) {
                handleInvalidApiKey(err.message);
            } else if (err instanceof RealPersonImageError) {
                // Only point at the verification flow when this deployment
                // actually has it — otherwise the advice names a hidden tab.
                const canVerify = isPortraitEnabled || (await loadPortraitEnabled());
                setError(realPersonReferenceErrorMessage(canVerify));
            } else {
                setError(
                    sanitizeStudioErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
                );
            }
            removeJob(tempId);
            removeItem(tempId);
            setCurrentJobId(null);
            if (options.rethrowOnError) {
                throw err;
            }
            return null;
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
            const captionMode = normalizeCaptionMode(
                item.createParams.caption_mode ??
                    captionModeFromLanguages(item.createParams.generated_caption_languages)
            );
            const voiceLanguage = normalizeVoiceLanguage(
                item.createParams.voice_language ??
                    (item.createParams.generate_audio ? DEFAULT_VOICE_LANGUAGE : SILENT_VOICE_LANGUAGE)
            );
            const titleOverlayText = normalizeTitleOverlayText(item.createParams.title_overlay_text);
            const titleOverlayEnabled = item.createParams.title_overlay_enabled === true && Boolean(titleOverlayText);
            return {
                ...item.createParams,
                prompt: cleanPromptForReuse(item.prompt),
                watermarkText: normalizeWatermarkText(item.createParams.watermarkText ?? item.brandingWatermark?.text),
                generate_audio: voiceLanguage !== SILENT_VOICE_LANGUAGE,
                avoid_generated_captions: captionMode === 'none',
                generated_captions: undefined,
                generated_caption_languages: undefined,
                voice_language: voiceLanguage,
                caption_mode: captionMode,
                title_overlay_enabled: titleOverlayEnabled,
                title_overlay_text: titleOverlayEnabled ? titleOverlayText : undefined,
                title_overlay_style: normalizeTitleOverlayStyle(item.createParams.title_overlay_style),
                title_overlay_duration: normalizeTitleOverlayDuration(item.createParams.title_overlay_duration),
                title_overlay_language: normalizeTitleOverlayLanguage(item.createParams.title_overlay_language)
            };
        }
        const parsed = parseSize(item.size);
        const model = getSeedanceModel(item.model) ? (item.model as VideoModel) : DEFAULT_MODEL;
        return {
            model,
            prompt: cleanPromptForReuse(item.prompt),
            ratio: parsed?.ratio ?? DEFAULT_RATIO,
            resolution: parsed?.resolution ?? DEFAULT_RESOLUTION,
            seconds: clampSeconds(item.seconds, model),
            generate_audio: true,
            camera_fixed: false,
            watermark: false,
            avoid_generated_captions: true,
            generated_captions: undefined,
            generated_caption_languages: undefined,
            voice_language: DEFAULT_VOICE_LANGUAGE,
            caption_mode: DEFAULT_CAPTION_MODE,
            title_overlay_enabled: false,
            title_overlay_text: undefined,
            title_overlay_style: DEFAULT_TITLE_OVERLAY_STYLE,
            title_overlay_duration: DEFAULT_TITLE_OVERLAY_DURATION,
            title_overlay_language: DEFAULT_TITLE_OVERLAY_LANGUAGE
        };
    }, []);

    const handleShareDialogOpenChange = React.useCallback((open: boolean) => {
        setIsShareDialogOpen(open);
        if (!open) {
            setShareUrlCopied(false);
            setSharePlatformNotice(null);
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

    const handleSocialShare = React.useCallback(
        async (target: SocialShareTarget) => {
            if (!shareDialogUrl) return;
            setSharePlatformNotice(null);

            if (target.copyFirst) {
                try {
                    await navigator.clipboard.writeText(shareDialogUrl);
                    setShareUrlCopied(true);
                    setSharePlatformNotice(`Link copied. Paste it into ${target.label} when the new tab opens.`);
                    setTimeout(() => setShareUrlCopied(false), 2000);
                } catch (err) {
                    console.error(`Failed to copy share URL before opening ${target.label}:`, err);
                    setSharePlatformNotice(`${target.label} opened. Copy the link manually if paste is unavailable.`);
                }
            }

            window.open(target.url(shareDialogUrl), '_blank', 'noopener,noreferrer');
        },
        [shareDialogUrl]
    );

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

                const reusablePrompt = cleanPromptForReuse(item.prompt);
                const sharePrompt = sharePromptWithinLimit(reusablePrompt);
                const promptWasShortened = sharePrompt.length !== reusablePrompt.trim().length;
                const shareParams = {
                    ...buildParamsFromItem(item),
                    prompt: sharePrompt
                };
                const share = await createShare(
                    {
                        videoId: item.id,
                        videoUrl: item.storedUrl,
                        prompt: sharePrompt,
                        params: shareParams,
                        title: shareTitleFromItem(item)
                    },
                    activeKey
                );
                setShareDialogId(share.id);
                setShareDialogUrl(`${window.location.origin}${studioVideoSharePath(locale, share.id)}`);
                if (promptWasShortened) {
                    setSharePlatformNotice('Prompt was shortened to 4000 characters for this share link.');
                }
            } catch (err) {
                console.error('Error creating share:', err);
                setShareDialogError(err instanceof Error ? err.message : 'Failed to create share.');
            } finally {
                setSharingVideoId(null);
            }
        },
        [buildParamsFromItem, resolveKey]
    );

    const applyParamsToCreationForm = React.useCallback(
        (params: CreationFormData) => {
            setCreateModel(params.model);
            setCreatePrompt(params.prompt);
            setCreateRatio(params.ratio);
            setCreateResolution(
                params.draft ? finalResolutionForDraft(params.model, params.final_resolution) : params.resolution
            );
            setCreateSeconds(params.seconds);
            setCreateVoiceLanguage(normalizeVoiceLanguage(params.voice_language));
            setCreateCaptionMode(normalizeCaptionMode(params.caption_mode));
            setCreateTitleOverlayEnabled(params.title_overlay_enabled === true && Boolean(params.title_overlay_text));
            setCreateTitleOverlayText(normalizeTitleOverlayText(params.title_overlay_text));
            setCreateTitleOverlayStyle(normalizeTitleOverlayStyle(params.title_overlay_style));
            setCreateTitleOverlayDuration(normalizeTitleOverlayDuration(params.title_overlay_duration));
            setCreateTitleOverlayLanguage(normalizeTitleOverlayLanguage(params.title_overlay_language));
            setCreateCameraFixed(params.camera_fixed ?? false);
            const refs =
                params.reference_image_urls ?? (params.input_reference_url ? [params.input_reference_url] : []);
            setCreateReferenceUrls(refs);
            setCreateLastFrameUrl(refs.length === 1 ? (params.last_frame_url ?? '') : '');
            setCreateReferenceAudioUrl(refs.length >= 2 ? (params.reference_audio_url ?? '') : '');
            setCreateReferenceVideoUrls((params.reference_video_urls ?? []).slice(0, MAX_REFERENCE_VIDEOS));
            setCreateSeed(params.seed);
            setCreateWatermark(params.watermark ?? false);
            setCreateWatermarkText(normalizeWatermarkText(params.watermarkText));
            navigateToTab('video');
            scrollToCreationForm();
        },
        [navigateToTab, scrollToCreationForm]
    );

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
        void (async () => {
            await handleCreateVideo(params, { replacesItem: item });
        })();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /** Finalize — open a review step before starting a paid draft-to-final generation. */
    const handleFinalizeItem = (item: VideoMetadata) => {
        setError(null, 'output');
        if (!modelSupportsFinalize(item.model)) {
            setError(FINALIZE_UNSUPPORTED_MODEL_MESSAGE, 'output');
            return;
        }
        setFinalizeSubmitLabel('');
        setFinalizeDialogItem(item);
    };

    const handleFinalizeDialogOpenChange = React.useCallback(
        (open: boolean) => {
            if (!open && !isFinalizeSubmitting) {
                setFinalizeDialogItem(null);
            }
        },
        [isFinalizeSubmitting]
    );

    const handleConfirmFinalize = (settings: FinalizeSettings) => {
        const item = finalizeDialogItem;
        if (!item) return;
        const params = buildParamsFromItem(item);
        const currentSource = getVideoSrc(item.id);
        const finalModel = DEFAULT_VIDEO_REFERENCE_MODEL;
        const editFinalResolution = finalResolutionForDraft(finalModel, settings.resolution);

        const buildEditParams = (draftVideoUrl: string): CreationFormData => ({
            ...params,
            model: finalModel,
            draft: false,
            prompt: ensureFinalizeEditPrompt(settings.prompt),
            resolution: editFinalResolution,
            seconds: settings.seconds,
            generate_audio: settings.generateAudio,
            reference_image_urls: settings.referenceImageUrls.length ? settings.referenceImageUrls : undefined,
            reference_video_urls: [draftVideoUrl],
            reference_video_seconds: [item.seconds],
            omni_reference_task_type: 'edit',
            omni_reference_ratio: 'adaptive',
            omni_reference_duration: -1,
            omit_resolution: true,
            camera_fixed: undefined,
            watermark: settings.watermark,
            watermarkText: settings.watermarkText
        });

        const buildCreateWithReferenceParams = (draftVideoUrl: string): CreationFormData => {
            const createFinalResolution = finalResolutionForDraft(finalModel, settings.resolution);
            const createParams: CreationFormData = {
                ...params,
                model: finalModel,
                draft: false,
                prompt: settings.prompt,
                resolution: createFinalResolution,
                seconds: settings.seconds,
                generate_audio: settings.generateAudio,
                reference_image_urls: settings.referenceImageUrls.length ? settings.referenceImageUrls : undefined,
                reference_video_urls: [draftVideoUrl],
                reference_video_seconds: [item.seconds],
                watermark: settings.watermark,
                watermarkText: settings.watermarkText
            };
            delete createParams.final_resolution;
            delete createParams.camera_fixed;
            delete createParams.omni_reference_task_type;
            delete createParams.omni_reference_ratio;
            delete createParams.omni_reference_duration;
            delete createParams.omit_resolution;
            delete createParams.omit_ratio;
            delete createParams.omit_duration;
            return createParams;
        };

        const providerUrl = item.providerUrl && /^https?:\/\//i.test(item.providerUrl) ? item.providerUrl : null;
        const storedUrl = item.storedUrl && /^https?:\/\//i.test(item.storedUrl) ? item.storedUrl : null;
        const createReferenceUrl =
            storedUrl || providerUrl || (currentSource && /^https?:\/\//i.test(currentSource) ? currentSource : null);
        if (process.env.NODE_ENV !== 'production') {
            console.info('Finalize reference video URL resolution:', {
                id: item.id,
                providerUrl: summarizeWebUrl(item.providerUrl),
                storedUrl: summarizeWebUrl(item.storedUrl),
                currentSource: summarizeWebUrl(currentSource),
                selected: summarizeWebUrl(providerUrl ?? storedUrl),
                fallbacks: [storedUrl, createReferenceUrl ? 'create-current-video-url' : null].filter(Boolean)
            });
        }
        setIsFinalizeSubmitting(true);
        setFinalizeSubmitLabel('Starting final generation...');
        void (async () => {
            if (providerUrl) {
                const providerParams = buildEditParams(providerUrl);
                try {
                    setFinalizeSubmitLabel('Creating final from provider draft URL...');
                    console.info('Finalize step start:', {
                        finalizeFlag: 0,
                        mode: 'update',
                        source: 'providerUrl',
                        referenceVideoUrl: summarizeWebUrl(providerUrl)
                    });
                    await handleCreateVideo(providerParams, {
                        title: item.title,
                        finalizeFlag: 0,
                        rethrowOnError: true,
                        onSubmitStage: setFinalizeSubmitLabel
                    });
                    console.info('Finalize step succeeded:', {
                        finalizeFlag: 0,
                        mode: 'update',
                        source: 'providerUrl'
                    });
                    return;
                } catch (error) {
                    if (!isReferenceVideoDownloadError(error)) throw error;
                    console.warn('edit providerUrl failed;', {
                        finalizeFlag: 0,
                        providerUrl: summarizeWebUrl(providerUrl),
                        storedUrl: summarizeWebUrl(storedUrl),
                        error
                    });
                }
            }

            if (storedUrl && storedUrl !== providerUrl) {
                const storedParams = buildEditParams(storedUrl);
                try {
                    setFinalizeSubmitLabel('Retrying with archived draft URL...');
                    console.info('Finalize step start:', {
                        finalizeFlag: 1,
                        mode: 'update',
                        source: 'storedUrl',
                        referenceVideoUrl: summarizeWebUrl(storedUrl)
                    });
                    await handleCreateVideo(storedParams, {
                        title: item.title,
                        finalizeFlag: 1,
                        rethrowOnError: true,
                        onSubmitStage: setFinalizeSubmitLabel
                    });
                    console.info('Finalize step succeeded:', { finalizeFlag: 1, mode: 'update', source: 'storedUrl' });
                    return;
                } catch (error) {
                    if (!isReferenceVideoDownloadError(error)) throw error;
                    console.warn('edit 1 storedUrl failed;', {
                        finalizeFlag: 1,
                        storedUrl: summarizeWebUrl(storedUrl),
                        error
                    });
                }
            }

            if (!createReferenceUrl) {
                throw new Error('Could not read this draft video for Finalize fallback.');
            }
            try {
                setFinalizeSubmitLabel('Creating final from current draft URL...');
                console.info('Finalize step start:', {
                    finalizeFlag: 2,
                    mode: 'create',
                    source: 'current-video-url',
                    referenceVideoUrl: summarizeWebUrl(createReferenceUrl)
                });
                const createParams = buildCreateWithReferenceParams(createReferenceUrl);
                const createJobId = await handleCreateVideo(createParams, {
                    title: item.title,
                    finalizeFlag: 2,
                    rethrowOnError: true,
                    onSubmitStage: setFinalizeSubmitLabel
                });
                if (!createJobId) {
                    throw new Error('Finalize create fallback did not start a video job.');
                }
                console.info('Finalize step succeeded:', {
                    finalizeFlag: 2,
                    mode: 'create',
                    source: 'current-video-url'
                });
            } catch (error) {
                console.warn('create 2 failed;', {
                    finalizeFlag: 2,
                    referenceVideoUrl: summarizeWebUrl(createReferenceUrl),
                    error
                });
                throw error;
            }
        })()
            .then(() => {
                setFinalizeDialogItem(null);
            })
            .catch((error) => {
                console.error('Finalize failed:', error);
                if (error instanceof RealPersonImageError) {
                    setError(realPersonReferenceErrorMessage(isPortraitEnabled), 'output');
                } else if (isReferenceVideoDownloadError(error)) {
                    setError(referenceVideoDownloadErrorMessage(), 'output');
                } else {
                    setError(
                        sanitizeStudioErrorMessage(error instanceof Error ? error.message : 'Finalize failed.'),
                        'output'
                    );
                }
            })
            .finally(() => {
                setIsFinalizeSubmitting(false);
                setFinalizeSubmitLabel('');
            });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleRenameHistoryItem = React.useCallback(
        (item: VideoMetadata, title: string) => {
            updateItem(item.id, { title: title.trim() || undefined });
        },
        [updateItem]
    );

    const performAddWatermarkToItem = React.useCallback(
        async (item: VideoMetadata, requestedText?: string) => {
            setError(null);

            try {
                const watermarkText = normalizeWatermarkText(requestedText);
                const record = await db.videos.get(item.id);
                let sourceBlob = record?.blob;
                let originalUrl = item.brandingWatermark?.originalUrl ?? item.storedUrl;
                const sourceUrl =
                    originalUrl ??
                    getVideoSrc(item.id) ??
                    (item.providerUrl && !providerLinkLikelyDead(item, Date.now()) ? item.providerUrl : undefined);

                if (!sourceBlob) {
                    if (!sourceUrl) throw new Error('Video source not found.');
                    sourceBlob = await videoService.downloadContent(item.id, sourceUrl);
                }

                const thumbnailBlob = record?.thumbnail ?? (await captureVideoPoster(sourceBlob));
                console.log(`[branding] adding watermark to existing video ${item.id}`);
                const brandedBlob = await burnBrandingWatermarkIntoVideo(sourceBlob, watermarkText, (progress) => {
                    if (progress === 0 || progress === 1) {
                        console.log(`[branding] ${item.id} ${Math.round(progress * 100)}%`);
                    }
                });

                await db.videos.put({
                    id: item.id,
                    filename: `${item.id}.mp4`,
                    blob: brandedBlob,
                    thumbnail: thumbnailBlob,
                    created_at: item.timestamp / 1000
                });

                const key = await resolveKey();
                if (!key) {
                    updateItem(item.id, {
                        storageModeUsed: 'indexeddb',
                        brandingWatermark: {
                            enabled: true,
                            text: watermarkText,
                            ...(originalUrl ? { originalUrl } : {})
                        }
                    });
                    return;
                }

                if (!originalUrl) {
                    const archivedOriginal = await archiveLocalVideo(item.id, sourceBlob, key, `${item.id}.mp4`);
                    if (archivedOriginal?.url) originalUrl = archivedOriginal.url;
                }

                const watermarkedId = watermarkedVideoId(item.id, watermarkText);
                const archived = await archiveLocalVideo(watermarkedId, brandedBlob, key, `${watermarkedId}.mp4`);
                if (!archived?.url) {
                    updateItem(item.id, {
                        storageModeUsed: 'indexeddb',
                        brandingWatermark: {
                            enabled: true,
                            text: watermarkText,
                            ...(originalUrl ? { originalUrl } : {})
                        }
                    });
                    setError(
                        'Watermark was added locally, but cloud upload did not complete. Try Archive later.',
                        'output'
                    );
                    return;
                }

                brandedStoredIdsRef.current.add(item.id);
                setRemoteSource(item.id, archived.url);
                updateItem(item.id, {
                    storedUrl: archived.url,
                    storageModeUsed: 'r2',
                    mediaExpired: false,
                    brandingWatermark: {
                        enabled: true,
                        text: watermarkText,
                        ...(originalUrl ? { originalUrl } : {}),
                        watermarkedUrl: archived.url
                    }
                });
                await syncNow();
                await db.videos.where('id').equals(item.id).delete();
                console.log(`[media-cache] removed local cached video for ${item.id}; using watermarked R2 playback`);
            } catch (err) {
                console.error(`Could not add watermark to ${item.id}:`, err);
                setError(err instanceof Error ? err.message : 'Could not add watermark to this video.', 'output');
            }
        },
        [getVideoSrc, resolveKey, setError, setRemoteSource, syncNow, updateItem, videoService]
    );

    const drainWatermarkQueue = React.useCallback(() => {
        if (watermarkActiveIdRef.current) return;
        const nextJob = watermarkQueueRef.current.shift();
        if (!nextJob) return;

        watermarkActiveIdRef.current = nextJob.item.id;
        setWatermarkActiveId(nextJob.item.id);

        void (async () => {
            try {
                await performAddWatermarkToItem(nextJob.item, nextJob.text);
            } finally {
                watermarkActiveIdRef.current = null;
                setWatermarkActiveId(null);
                const nextPendingIds = new Set(watermarkPendingIdsRef.current);
                nextPendingIds.delete(nextJob.item.id);
                watermarkPendingIdsRef.current = nextPendingIds;
                setWatermarkPendingIds(nextPendingIds);
                queueMicrotask(drainWatermarkQueue);
            }
        })();
    }, [performAddWatermarkToItem]);

    const handleAddWatermarkToItem = React.useCallback(
        (item: VideoMetadata, requestedText?: string) => {
            if (item.brandingWatermark?.enabled) return;
            if (watermarkPendingIdsRef.current.has(item.id) || watermarkPendingIdsRef.current.size >= 2) return;
            const nextPendingIds = new Set(watermarkPendingIdsRef.current);
            nextPendingIds.add(item.id);
            watermarkPendingIdsRef.current = nextPendingIds;
            setWatermarkPendingIds(nextPendingIds);
            watermarkQueueRef.current.push({ item, text: requestedText });
            drainWatermarkQueue();
        },
        [drainWatermarkQueue]
    );

    const handleRemoveWatermarkFromItem = React.useCallback(
        async (item: VideoMetadata) => {
            const originalUrl = item.brandingWatermark?.originalUrl;
            if (!item.brandingWatermark?.enabled) return;
            if (!originalUrl) {
                setError('Original unwatermarked video is not available for this item.', 'output');
                return;
            }

            setRemoteSource(item.id, originalUrl);
            updateItem(item.id, {
                storedUrl: originalUrl,
                storageModeUsed: 'r2',
                mediaExpired: false,
                brandingWatermark: {
                    ...item.brandingWatermark,
                    enabled: false,
                    originalUrl
                }
            });
            await syncNow();
        },
        [setError, setRemoteSource, syncNow, updateItem]
    );

    /** 续片 — continue a completed video from its final frame. */
    const handleExtendVideo = React.useCallback(
        async (item: VideoMetadata) => {
            setError(null);
            markExtendPending(item.id, true);

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
                setCreatePrompt('继续上一段视频，从当前最后一帧自然衔接并推进下一段内容。');
                setCreateRatio(params.ratio);
                setCreateResolution(params.resolution);
                setCreateSeconds(params.seconds);
                setCreateVoiceLanguage(normalizeVoiceLanguage(params.voice_language));
                setCreateCaptionMode(normalizeCaptionMode(params.caption_mode));
                setCreateTitleOverlayEnabled(
                    params.title_overlay_enabled === true && Boolean(params.title_overlay_text)
                );
                setCreateTitleOverlayText(normalizeTitleOverlayText(params.title_overlay_text));
                setCreateTitleOverlayStyle(normalizeTitleOverlayStyle(params.title_overlay_style));
                setCreateTitleOverlayDuration(normalizeTitleOverlayDuration(params.title_overlay_duration));
                setCreateTitleOverlayLanguage(normalizeTitleOverlayLanguage(params.title_overlay_language));
                setCreateCameraFixed(params.camera_fixed ?? false);
                setCreateReferenceUrls([frameUrl]);
                setCreateLastFrameUrl('');
                setCreateReferenceAudioUrl('');
                setCreateReferenceVideoUrls([]);
                setCreateSeed(params.seed);
                setCreateWatermark(params.watermark ?? false);
                setCreateWatermarkText(normalizeWatermarkText(params.watermarkText));
                setError(
                    'Extend loaded the last frame as the next segment’s first frame. Edit the prompt, then create.',
                    'create'
                );
                navigateToTab('video');
                await scrollToCreationForm();
            } catch (err) {
                console.error('Error extending video:', err);
                if (err instanceof InvalidApiKeyError) {
                    handleInvalidApiKey(err.message);
                } else {
                    setError(
                        sanitizeStudioErrorMessage(err instanceof Error ? err.message : 'Failed to extend video'),
                        'output'
                    );
                }
            } finally {
                markExtendPending(item.id, false);
            }
        },
        [
            buildParamsFromItem,
            declareGeneratedReference,
            getVideoSrc,
            handleInvalidApiKey,
            handleUploadImage,
            markExtendPending,
            navigateToTab,
            scrollToCreationForm,
            setError
        ]
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
        async (
            item: VideoMetadata,
            options: { force?: boolean; ignoreLocal?: boolean; allowProviderProbe?: boolean } = {}
        ) => {
            if (!options.ignoreLocal && hasLocalCopy(item.id)) {
                markPreviewResolving(item.id, false);
                markPreviewUnresolved(item.id, false);
                return;
            }

            if (item.storedUrl) {
                if (getVideoSrc(item.id) !== item.storedUrl) setRemoteSource(item.id, item.storedUrl);
                markPreviewResolving(item.id, false);
                markPreviewUnresolved(item.id, false);
                return;
            }

            if (await resolveArchivedPlayback(item.id)) {
                return;
            }

            if (item.providerUrl && !providerLinkLikelyDead(item, Date.now())) {
                if (getVideoSrc(item.id) !== item.providerUrl) setRemoteSource(item.id, item.providerUrl);
                markPreviewResolving(item.id, false);
                markPreviewUnresolved(item.id, false);
                return;
            }

            if (item.status === 'failed') return;

            if (item.mediaExpired || providerLinkLikelyDead(item, Date.now())) {
                markPreviewResolving(item.id, false);
                updateItem(item.id, { mediaExpired: true });
                return;
            }

            if (options.allowProviderProbe === false) return;

            // Without force, don't re-probe what already plays or what we
            // already know the gateway has nothing for.
            if (!options.force && (hasSource(item.id) || unresolvedPreviewIdsRef.current.has(item.id))) return;

            markPreviewResolving(item.id, true);
            try {
                const fresh = await videoService.retrieveVideo(item.id, { force: true });
                if (fresh.output_url) {
                    setRemoteSource(item.id, fresh.output_url);
                    updateItem(item.id, { providerUrl: fresh.output_url });
                    markPreviewUnresolved(item.id, false);
                } else {
                    markPreviewUnresolved(item.id, true);
                }
            } catch (err) {
                markPreviewUnresolved(item.id, true);
                console.warn(`Could not resolve a source for ${item.id}:`, err);
            } finally {
                markPreviewResolving(item.id, false);
            }
        },
        [
            getVideoSrc,
            hasLocalCopy,
            hasSource,
            markPreviewResolving,
            markPreviewUnresolved,
            resolveArchivedPlayback,
            setRemoteSource,
            updateItem,
            videoService
        ]
    );

    const bootSourceHydrationRef = React.useRef<Map<string, string>>(new Map());
    React.useEffect(() => {
        if (isInitialLoad) return;

        const candidates = history.filter((item) => item.status === 'completed');
        if (candidates.length === 0) return;

        let cancelled = false;
        void (async () => {
            for (const item of candidates) {
                if (cancelled) return;

                const fingerprint = [
                    item.storedUrl ?? '',
                    item.providerUrl ?? '',
                    String(item.mediaExpired ?? false),
                    String(item.durationMs ?? 0)
                ].join('|');
                if (bootSourceHydrationRef.current.get(item.id) === fingerprint) continue;
                bootSourceHydrationRef.current.set(item.id, fingerprint);

                await resolvePlaybackSource(item, { allowProviderProbe: false });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [history, isInitialLoad, resolvePlaybackSource]);

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
                ...(item.error && { error: { message: sanitizeStudioErrorMessage(item.error) } }),
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
        markPreviewResolving(item.id, true);
        retryArchive(item.id);
        void (async () => {
            try {
                await resolvePlaybackSource(item, { force: true });
            } finally {
                markPreviewResolving(item.id, false);
            }
        })();
    }, [currentJobId, history, markPreviewResolving, markPreviewUnresolved, resolvePlaybackSource, retryArchive]);

    const markManualArchive = React.useCallback((id: string, pending: boolean) => {
        setManualArchiveIds((prev) => {
            if (prev.has(id) === pending) return prev;
            const next = new Set(prev);
            if (pending) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const handleRetryArchive = React.useCallback(
        async (id: string) => {
            console.log('handleRetryArchive:', id, manualArchiveIds);
            if (manualArchiveIds.has(id)) return;

            const item = history.find((candidate) => candidate.id === id);
            if (!item || item.storedUrl) return;

            markManualArchive(id, true);
            markPreviewUnresolved(id, false);
            markPreviewResolving(id, true);
            setError(null);

            try {
                const key = await resolveKey();
                if (!key) {
                    setIsApiKeyDialogOpen(true);
                    setError('Sign in or enter your Xcity API key before archiving.', 'output');
                    return;
                }

                let archived = await fetchArchivedVideo(id, key);
                if (!archived) {
                    const localRecord = await db.videos.get(id);
                    if (localRecord?.blob) {
                        archived = await archiveLocalVideo(id, localRecord.blob, key, localRecord.filename);
                    }
                }

                if (!archived) {
                    let sourceUrl =
                        item.providerUrl && !providerLinkLikelyDead(item, Date.now()) ? item.providerUrl : undefined;

                    if (!sourceUrl) {
                        try {
                            sourceUrl = (await videoService.retrieveVideo(id, { force: true })).output_url;
                        } catch (err) {
                            console.warn(`Could not re-read output_url for ${id}:`, err);
                        }
                    }

                    if (sourceUrl) {
                        setRemoteSource(id, sourceUrl);
                        updateItem(id, { providerUrl: sourceUrl, mediaExpired: false });
                        try {
                            archived = await archiveVideo(id, sourceUrl, key);
                        } catch (err) {
                            if (!(err instanceof ArchiveSourceFetchError)) throw err;

                            const freshSourceUrl = (
                                await videoService.retrieveVideo(id, { force: true }).catch((readErr) => {
                                    console.warn(`Could not refresh output_url for ${id}:`, readErr);
                                    return null;
                                })
                            )?.output_url;

                            if (!freshSourceUrl || freshSourceUrl === sourceUrl) throw err;

                            setRemoteSource(id, freshSourceUrl);
                            updateItem(id, { providerUrl: freshSourceUrl, mediaExpired: false });
                            archived = await archiveVideo(id, freshSourceUrl, key);
                        }
                    }
                }

                if (archived?.url) {
                    setRemoteSource(id, archived.url);
                    markPreviewUnresolved(id, false);
                    updateItem(id, {
                        storedUrl: archived.url,
                        storageModeUsed: 'r2',
                        status: 'completed',
                        progress: 100,
                        mediaExpired: false
                    });
                    await syncNow();
                    return;
                }

                retryArchive(id);
                if (!hasLocalCopy(id) && providerLinkLikelyDead(item, Date.now())) {
                    updateItem(id, { mediaExpired: true });
                    setError(
                        'Archive failed because this video has no local cache and the provider playback link has expired. Regenerate it to create a new video id.',
                        'output'
                    );
                    return;
                }

                setError('Archive did not complete. The background archiver will retry automatically.', 'output');
            } catch (err) {
                console.error(`Manual archive failed for ${id}:`, err);
                retryArchive(id);
                setError(err instanceof Error ? err.message : 'Archive failed', 'output');
            } finally {
                markPreviewResolving(id, false);
                markManualArchive(id, false);
            }
        },
        [
            hasLocalCopy,
            history,
            manualArchiveIds,
            markManualArchive,
            markPreviewResolving,
            markPreviewUnresolved,
            resolveKey,
            retryArchive,
            setError,
            setRemoteSource,
            syncNow,
            updateItem,
            videoService
        ]
    );

    const handleClearHistory = async () => {
        const confirmed = window.confirm(
            'Clear the entire video history? This deletes videos from this browser and attempts to remove archived cloud copies. Your Xcity billing history is not affected. This cannot be undone.'
        );
        if (!confirmed) return;

        const itemsToDelete = [...history];
        clearAll();
        clearJobs();
        setCurrentJobId(null);
        setError(null);

        try {
            await db.videos.clear();
            clearAllSources();
            await Promise.allSettled(itemsToDelete.map((item) => deleteCloudCopyForItem(item)));
            await syncNow();
        } catch (e) {
            console.error('Failed during history clearing:', e);
            setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const handleDeleteVideo = async (item: VideoMetadata) => {
        console.log(`Deleting video: ${item.id}`);
        setError(null);

        try {
            await deleteCloudCopyForItem(item).catch((err) => {
                console.warn(`Could not delete archived cloud copy for ${item.id}:`, err);
            });
            await db.videos.where('id').equals(item.id).delete();
            removeSource(item.id);
            removeItem(item.id);
            removeJob(item.id);
            if (currentJobId === item.id) {
                setCurrentJobId(null);
            }
            await syncNow();
        } catch (err) {
            console.error('Error deleting video:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete video', 'output');
        }
    };

    const handleDownloadVideo = async (videoId: string) => {
        try {
            const item = history.find((candidate) => candidate.id === videoId);
            const url =
                getVideoSrc(videoId) ??
                item?.storedUrl ??
                (item?.providerUrl && !providerLinkLikelyDead(item, Date.now()) ? item.providerUrl : undefined);
            if (!url) {
                throw new Error('Video source not found');
            }
            const blob = await videoService.downloadContent(videoId, url);
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = `${videoId}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
        } catch (err) {
            console.error('Error downloading video:', err);
            setError(err instanceof Error ? err.message : 'Failed to download video', 'output');
        }
    };

    const handleSaveApiKey = async (rawKey: string) => {
        await saveManualKey(rawKey);
        await syncCloudNow();
        setError(null);
    };

    const currentJob = currentJobId ? activeJobs.get(currentJobId) : null;
    const currentHistoryItem = currentJobId ? history.find((item) => item.id === currentJobId) : undefined;
    const currentHistoryItemIsDraft =
        currentHistoryItem?.draft === true || currentHistoryItem?.createParams?.draft === true;
    const currentFinalizeDisabledReason =
        currentHistoryItemIsDraft && currentHistoryItem && !modelSupportsFinalize(currentHistoryItem.model)
            ? FINALIZE_UNSUPPORTED_MODEL_MESSAGE
            : undefined;
    const currentMediaExpired = Boolean(
        currentHistoryItem?.status === 'completed' &&
            !currentHistoryItem.storedUrl &&
            !hasLocalCopy(currentHistoryItem.id) &&
            (currentHistoryItem.mediaExpired || providerLinkLikelyDead(currentHistoryItem, Date.now()))
    );
    const currentFallbackVideoSrc =
        currentHistoryItem?.storedUrl ??
        (currentHistoryItem?.providerUrl && !providerLinkLikelyDead(currentHistoryItem, Date.now())
            ? currentHistoryItem.providerUrl
            : undefined);
    const currentVideoSrc =
        currentJobId && !currentMediaExpired ? (getVideoSrc(currentJobId) ?? currentFallbackVideoSrc) : null;
    const currentThumbnailSrc = currentJobId ? getThumbnailSrc(currentJobId) : null;
    const shotVideoPreviews = React.useMemo(() => shotVideoPreviewsForProject({ history, activeJobs, projectId: projectDraft.activeProject.id, getVideoSrc, getThumbnailSrc }), [activeJobs, getThumbnailSrc, getVideoSrc, history, projectDraft.activeProject.id]);

    React.useEffect(() => {
        if (currentHistoryItem?.status === 'completed' && currentVideoSrc) {
            previewStateActionsRef.current.markPreviewUnresolved(currentHistoryItem.id, false);
            previewStateActionsRef.current.markPreviewResolving(currentHistoryItem.id, false);
            return;
        }

        if (
            currentHistoryItem?.status === 'completed' &&
            !currentVideoSrc &&
            !currentMediaExpired &&
            !unresolvedPreviewIds.has(currentHistoryItem.id)
        ) {
            void resolvePlaybackSource(currentHistoryItem);
        }
    }, [currentHistoryItem, currentMediaExpired, currentVideoSrc, resolvePlaybackSource, unresolvedPreviewIds]);

    // Without SSO the manual key is the only way in — gate until one is set.
    const isApiKeyGateBlocked = videoMode === 'normal' && !XCITY_SSO_ENABLED && !apiKey;

    const videoTabContent = (
        <>
            <FinalizeDialog
                key={finalizeDialogItem?.id ?? 'finalize-dialog'}
                item={finalizeDialogItem}
                open={Boolean(finalizeDialogItem)}
                isSubmitting={isFinalizeSubmitting}
                submittingLabel={finalizeSubmitLabel}
                defaultWatermarkText={BRANDING_WATERMARK_TEXT}
                declarations={effectiveDeclarations}
                approvedAuthorizationIds={approvedAuthorizationIds}
                characters={characters}
                portraits={portraits}
                imageAssets={imageAssets}
                isLoadingImageAssets={isLoadingImageAssets}
                onRefreshImageAssets={() => void refreshImageAssets()}
                onDeclareReference={handleDeclareReference}
                onReviewReferenceAsset={isPortraitEnabled ? handleReviewReferenceAsset : undefined}
                onUploadImage={uploadEnabled ? handleUploadImage : undefined}
                onOpenAssets={uploadEnabled || isPortraitEnabled ? () => navigateToTab('assets') : undefined}
                onOpenChange={handleFinalizeDialogOpenChange}
                onConfirm={handleConfirmFinalize}
            />
            {shareNotice && (
                <Alert className='border-white/15 bg-white/5 text-white'>
                    <AlertTitle className='text-white'>{t('Shared settings')}</AlertTitle>
                    <AlertDescription className='text-white/70'>{shareNotice}</AlertDescription>
                </Alert>
            )}
            <div className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(560px,1.2fr)] lg:items-start xl:grid-cols-[minmax(0,0.75fr)_minmax(640px,1.25fr)]'>
                <div ref={creationFormRef} className='relative flex min-h-[600px] flex-col overflow-hidden lg:sticky lg:top-6 lg:col-span-1 lg:h-[calc(100vh-3rem)] lg:min-h-0 lg:self-start'>
                    <ApiKeyGate
                        isBlocked={isApiKeyGateBlocked}
                        onConfigure={() => setIsApiKeyDialogOpen(true)}
                        className='flex-1'>
                        {XCITY_SSO_ENABLED && ssoStatus !== 'ok' ? (
                            <AccountConnection
                                checking={ssoStatus === 'checking'}
                                error={ssoStatus === 'error' ? ssoError : null}
                                onRetry={() => void attemptSso()}
                                onConfigure={() => setIsApiKeyDialogOpen(true)}
                            />
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
                                voiceLanguage={createVoiceLanguage}
                                setVoiceLanguage={setCreateVoiceLanguage}
                                captionMode={createCaptionMode}
                                setCaptionMode={setCreateCaptionMode}
                                titleOverlayEnabled={createTitleOverlayEnabled}
                                setTitleOverlayEnabled={setCreateTitleOverlayEnabled}
                                titleOverlayText={createTitleOverlayText}
                                setTitleOverlayText={setCreateTitleOverlayText}
                                titleOverlayStyle={createTitleOverlayStyle}
                                setTitleOverlayStyle={setCreateTitleOverlayStyle}
                                titleOverlayDuration={createTitleOverlayDuration}
                                setTitleOverlayDuration={setCreateTitleOverlayDuration}
                                titleOverlayLanguage={createTitleOverlayLanguage}
                                setTitleOverlayLanguage={setCreateTitleOverlayLanguage}
                                cameraFixed={createCameraFixed}
                                setCameraFixed={setCreateCameraFixed}
                                referenceUrls={createReferenceUrls}
                                setReferenceUrls={setCreateReferenceUrls}
                                declarations={effectiveDeclarations}
                                onDeclareReference={handleDeclareReference}
                                approvedAuthorizationIds={approvedAuthorizationIds}
                                characters={characters}
                                portraits={portraits}
                                virtualCharacterGroups={virtualCharacterGroups}
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
                                watermarkText={createWatermarkText}
                                setWatermarkText={setCreateWatermarkText}
                                onUploadImage={uploadEnabled ? handleUploadImage : undefined}
                                onUploadAudio={uploadEnabled ? handleUploadAudio : undefined}
                                onSynthesizeSpeech={uploadEnabled ? handleSynthesizeSpeech : undefined}
                                onUploadVideo={uploadEnabled ? handleUploadVideo : undefined}
                                onReviewReferenceAsset={isPortraitEnabled ? handleReviewReferenceAsset : undefined}
                                onOptimizePrompt={handleOptimizePrompt}
                                onBreakdownScript={handleBreakdownScript}
                                onAutoBindSceneAssets={handleAutoBindSceneAssets}
                                onAutoBindCharacterAssets={handleAutoBindCharacterAssets}
                                shotVideoPreviews={shotVideoPreviews}
                                projectAssets={projectDraft.projectAssets}
                                projectConfig={projectDraft.activeProject}
                                buildProductionSnapshot={projectDraft.buildProductionSnapshot}
                                projectControls={{
                                    project: projectDraft.activeProject, projects: projectDraft.projects, projectAssets: projectDraft.projectAssets, onCreateProject: projectDraft.addProject,
                                    onSelectProject: projectDraft.setActiveProjectId, onUpdateProject: projectDraft.updateActiveProject, onDeleteProject: projectDraft.deleteProject, deletionBlocked: isSubmitting || activeJobs.size > 0
                                }}
                                storyboardEditorOpen={isShotBuilderOpen}
                                onStoryboardEditorOpenChange={setIsShotBuilderOpen}
                                // Only offer the jump when the Assets tab actually exists —
                                // it is gated on the media worker / portrait library.
                                onOpenAssets={
                                    uploadEnabled || isPortraitEnabled ? () => navigateToTab('assets') : undefined
                                }
                                notice={createNotice}
                                onClearNotice={() => setCreateNotice(null)}
                                error={createError}
                            />
                        )}
                    </ApiKeyGate>
                </div>
                <div className='flex min-h-[600px] flex-col lg:sticky lg:top-6 lg:col-span-1 lg:h-[calc(100vh-3rem)] lg:min-h-0 lg:self-start'>
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
                        isExtendPending={Boolean(currentJobId && extendPendingIds.has(currentJobId))}
                        onFinalize={currentHistoryItemIsDraft ? handleFinalizeCurrentVideo : undefined}
                        finalizeDisabledReason={currentFinalizeDisabledReason}
                        onShare={handleShareItem}
                        shareItem={currentHistoryItem}
                        isSharePending={Boolean(currentHistoryItem && sharingVideoId === currentHistoryItem.id)}
                        previewUnavailable={Boolean(currentJobId && unresolvedPreviewIds.has(currentJobId))}
                        isPreviewResolving={Boolean(currentJobId && resolvingPreviewIds.has(currentJobId))}
                        onRetryPreview={handleRetryPreview}
                        error={outputError}
                    />
                </div>
            </div>

            <GallerySection onUsePreset={applyPreset} onUseAsReference={applyReferenceFrame} />

            {videoMode !== 'drama' && <div className='min-h-[450px]'>
                <VideoHistoryPanel
                    history={history}
                    activeJobs={activeJobs}
                    isInitialLoad={isInitialLoad}
                    onSelectVideo={handleHistorySelect}
                    onClearHistory={handleClearHistory}
                    getVideoSrc={getVideoSrc}
                    getThumbnailSrc={getThumbnailSrc}
                    hasLocalCopy={hasLocalCopy}
                    onRetryArchive={handleRetryArchive}
                    archivePendingIds={manualArchiveIds}
                    onDeleteItem={handleDeleteVideo}
                    onReuseItem={handleReuseItem}
                    onRegenerateItem={handleRegenerateItem}
                    onFinalizeItem={handleFinalizeItem}
                    onExtendItem={handleExtendVideo}
                    extendPendingIds={extendPendingIds}
                    onShareItem={handleShareItem}
                    onAddWatermark={handleAddWatermarkToItem}
                    onRemoveWatermark={handleRemoveWatermarkFromItem}
                    onRenameItem={handleRenameHistoryItem}
                    sharePendingId={sharingVideoId}
                    watermarkPendingIds={watermarkPendingIds}
                    watermarkActiveId={watermarkActiveId}
                    loadAudioAssets={handleLoadAssemblyAudioAssets}
                    onTranscribeVideo={handleTranscribeVideo}
                />
            </div>}
        </>
    );

    return (
        <main data-studio-workspace className='bg-black py-4 text-white md:py-8 lg:py-12'>
            <ApiKeyDialog isOpen={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen} onSave={handleSaveApiKey} />
            <Dialog open={isShareDialogOpen} onOpenChange={handleShareDialogOpenChange}>
                <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[460px]'>
                    <DialogHeader>
                        <DialogTitle className='text-white'>{t('Share video')}</DialogTitle>
                        <DialogDescription className='text-neutral-400'>
                            {t('Anyone with this link can view the video and recreate its prompt settings')}
                        </DialogDescription>
                    </DialogHeader>
                    {sharingVideoId ? (
                        <div className='flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70'>
                            <Loader2 className='h-4 w-4 animate-spin' />
                            {t('Creating share link')}
                        </div>
                    ) : shareDialogError ? (
                        <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200'>
                            {shareDialogError}
                        </div>
                    ) : shareDialogUrl ? (
                        <div className='space-y-3'>
                            <div className='relative'>
                                <Input
                                    readOnly
                                    value={shareDialogUrl}
                                    onFocus={(event) => event.currentTarget.select()}
                                    className='border-white/20 bg-black pr-11 text-white'
                                    aria-label={t('Share URL')}
                                />
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='icon'
                                    onClick={handleCopyShareUrl}
                                    className='absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 text-white/70 hover:bg-white/10 hover:text-white'
                                    aria-label={shareUrlCopied ? t('Share link copied') : t('Copy share link')}>
                                    {shareUrlCopied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
                                </Button>
                            </div>
                            <p className='text-xs text-neutral-400'>
                                {t(
                                    'Recreate links include only the prompt and generation settings<dot> Reference media are not shared'
                                )}
                            </p>
                            <div className='space-y-2'>
                                <p className='text-xs font-medium text-white/70'>{t('Forward to')}</p>
                                <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                                    {SOCIAL_SHARE_TARGETS.map((target) => (
                                        <Button
                                            key={target.id}
                                            type='button'
                                            variant='secondary'
                                            onClick={() => void handleSocialShare(target)}
                                            className='min-w-0 justify-start bg-white/10 text-white hover:bg-white/20'>
                                            <ExternalLink className='h-4 w-4' />
                                            <span className='truncate'>{target.label}</span>
                                        </Button>
                                    ))}
                                </div>
                                {sharePlatformNotice && (
                                    <p className='text-xs text-neutral-300'>{sharePlatformNotice}</p>
                                )}
                            </div>
                            {shareCommunityStatus === 'submitted' ? (
                                <div className='flex items-center gap-2 rounded-md border border-green-500/25 bg-green-500/10 px-3 py-2 text-sm text-green-200'>
                                    <Check className='h-4 w-4' />
                                    {t('Submitted for review')}
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
                                    {t('Submit to community')}
                                </Button>
                            )}
                            {shareCommunityError && <p className='text-xs text-red-300'>{shareCommunityError}</p>}
                        </div>
                    ) : null}
                    <DialogFooter>
                        {shareDialogUrl && (
                            <Button asChild className='bg-white text-black hover:bg-white/90'>
                                <a href={shareDialogUrl} target='_blank' rel='noreferrer'>
                                    {t('Open')}
                                </a>
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className='mx-auto w-full max-w-7xl space-y-6 px-4 md:px-6'>
                {imageTabEnabled || uploadEnabled || isPortraitEnabled ? (
                    <Tabs value={activeTab} onValueChange={(value) => navigateToTab(value as StudioTab)}>
                        <TabsContent value='video' className='space-y-6'>
                            {videoTabContent}
                        </TabsContent>
                        {imageTabEnabled && (
                            <TabsContent value='image'>
                                <ImageStudio
                                    imageModels={imageModels}
                                    onGenerate={handleGenerateImages}
                                    cloudImageAssets={imageAssets}
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
                                        deletedIds={deletedIds}
                                        declarations={effectiveDeclarations}
                                        referenceImageUrls={createReferenceUrls}
                                        addPortrait={addPortrait}
                                        syncPortraitState={syncNow}
                                        removePortrait={removePortrait}
                                        startPortraitSession={handleStartPortraitSession}
                                        loadPortraitGroups={handleLoadPortraitGroups}
                                        loadPortraitAssets={handleLoadPortraitAssets}
                                        createPortraitGroup={handleCreatePortraitGroup}
                                        deletePortraitGroup={handleDeletePortraitGroup}
                                        createPortraitAsset={handleCreatePortraitAsset}
                                        getPortraitAsset={handleGetPortraitAsset}
                                        getPortraitStatus={handleGetPortraitStatus}
                                        reviewAsset={handleReviewReferenceAsset}
                                        onUseAsReference={handleUseAssetAsReference}
                                        onUseAsReferenceVideo={handleUseAssetAsReferenceVideo}
                                        onAttachAssetId={handleAttachAssetIdToProject}
                                        onUpdateOfficialAssetNote={handleUpdateOfficialAssetNote}
                                        projectAssets={projectDraft.projectAssets}
                                        onChangeProjectAssetKind={projectDraft.updateProjectAssetKind}
                                        onRemoveProjectAsset={projectDraft.archiveProjectAsset}
                                        onSyncProjectAssetStatuses={projectDraft.syncProjectAssetStatuses}
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
