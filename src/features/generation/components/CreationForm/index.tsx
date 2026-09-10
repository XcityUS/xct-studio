'use client';

import { CharacterSelectors } from './CharacterSelectors';
import { DramaLaunchPanel } from './DramaLaunchPanel';
import { InlineError } from './InlineError';
import { CAMERA_TEMPLATES, nativeCheckboxClass, nativeRangeClass } from './constants';
import { useCreationOptions } from './options';
import { readShotQueue, storyboardQueueSignature, type ShotQueueItem, type ShotQueueScope, writeShotQueue } from './shot-queue';
import { SHOT_GENERATION_BATCH_LIMIT, storyboardVideoQueueItems } from './storyboard-video-queue';
import { createSubmissionBuilder } from './submission';
import type { CreationFormProps, GenerationMode } from './types';
import { useProjectConfig } from './use-project-config';
import { useSceneAssetAutobind } from './use-scene-asset-autobind';
import { appendCharacterPromptLine, referenceLabelsFor, referenceVideoPreviewsFor } from './utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { ReferenceAudioInput } from '@/features/assets/components/ReferenceAudioInput';
import { ReferenceImagesInput } from '@/features/assets/components/ReferenceImagesInput';
import { ReferenceVideosInput } from '@/features/assets/components/ReferenceVideosInput';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import {
    ASSET_LIBRARY_MODEL_BLOCK_REASON,
    declarationBlockReason,
    declarationSatisfied,
    refKey,
    referenceRequiresAssetLibrary
} from '@/features/assets/reference/origin';
import { useReferenceCopy } from '@/features/assets/reference/use-copy';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/hooks/use-video-history';
import { calculateVideoCost } from '@/features/generation/utils/cost';
import { useVideoMode } from '@/features/projects/hooks/use-video-mode';
import { PromptInspirationDialog } from '@/features/script/components/PromptInspirationDialog';
import { ShotBuilderDialog } from '@/features/script/components/ShotBuilderDialog';
import { recalledDraft, rememberDraft, type EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import {
    MAX_TITLE_OVERLAY_TEXT_LENGTH,
    SILENT_VOICE_LANGUAGE,
    normalizeCaptionMode,
    normalizeTitleOverlayDuration,
    normalizeTitleOverlayLanguage,
    normalizeTitleOverlayStyle,
    normalizeTitleOverlayText,
    normalizeVoiceLanguage
} from '@/features/script/prompt/guards';
import { applyPromptTemplate } from '@/features/script/prompt/templates';
import { usePromptTemplateLabels } from '@/features/script/prompt/use-template-labels';
import { XCITY_BILLING_URL, shouldShowBillingAction } from '@/features/settings/billing';
import {
    DEFAULT_MODEL,
    DEFAULT_VIDEO_REFERENCE_MODEL,
    RESOLUTIONS,
    clampSeconds,
    getSeedanceModel,
    maxReferenceImages,
    modelSupportsResolution,
    secondsRange,
    type VideoModel,
    type VideoRatio,
    type VideoResolution
} from '@/shared/config/seedance';
import { cn } from '@/shared/utils/classnames';
import { ChevronDown, CreditCard, HelpCircle, Lightbulb, Loader2, Sparkles, Undo2, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export type { CreationFormData, SceneAssetBindingProgress, ShotVideoPreview } from './types';

export function CreationForm({
    onSubmit,
    isLoading,
    model,
    setModel,
    prompt,
    setPrompt,
    ratio,
    setRatio,
    resolution,
    setResolution,
    seconds,
    setSeconds,
    cameraFixed,
    setCameraFixed,
    referenceUrls,
    setReferenceUrls,
    declarations,
    onDeclareReference,
    approvedAuthorizationIds,
    characters,
    portraits,
    virtualCharacterGroups,
    lastFrameUrl,
    setLastFrameUrl,
    referenceAudioUrl,
    setReferenceAudioUrl,
    referenceVideoUrls,
    setReferenceVideoUrls,
    seed,
    setSeed,
    watermark,
    setWatermark,
    watermarkText,
    setWatermarkText,
    voiceLanguage,
    setVoiceLanguage,
    captionMode,
    setCaptionMode,
    titleOverlayEnabled,
    setTitleOverlayEnabled,
    titleOverlayText,
    setTitleOverlayText,
    titleOverlayStyle,
    setTitleOverlayStyle,
    titleOverlayDuration,
    setTitleOverlayDuration,
    titleOverlayLanguage,
    setTitleOverlayLanguage,
    onUploadImage,
    onUploadAudio,
    onSynthesizeSpeech,
    onUploadVideo,
    onReviewReferenceAsset,
    onOptimizePrompt,
    onBreakdownScript,
    onAutoBindSceneAssets,
    projectAssets = [], projectConfig, buildProductionSnapshot, onOpenAssets, projectControls, storyboardEditorOpen, onStoryboardEditorOpenChange, onStoryboardDraftChange, shotVideoPreviews = [],
    notice,
    onClearNotice,
    error
}: CreationFormProps) {
    const t = useTranslations();
    const [videoMode] = useVideoMode();
    const creationOptions = useCreationOptions();
    const templateLabel = usePromptTemplateLabels();
    const referenceCopy = useReferenceCopy();
    const activeModel = getSeedanceModel(model) ? model : DEFAULT_MODEL;
    const { min: minSeconds, max: maxSeconds } = secondsRange(activeModel);
    const activeSeconds = clampSeconds(seconds, activeModel);
    const modelDef = getSeedanceModel(activeModel);
    const refCap = maxReferenceImages(activeModel);
    const isFirstFrameMode = referenceUrls.length === 1;
    const supportsMultiReferenceMedia = refCap > 1;
    const showMultiReferenceMedia = supportsMultiReferenceMedia && referenceUrls.length >= 2;
    const showReferenceAudio = showMultiReferenceMedia;
    const showReferenceVideos = supportsMultiReferenceMedia;
    const attachedReferenceUrls = React.useMemo(() => {
        const refs = referenceUrls.map((url) => url.trim()).filter(Boolean);
        const lastFrame = lastFrameUrl.trim();
        return lastFrame ? [...refs, lastFrame] : refs;
    }, [lastFrameUrl, referenceUrls]);
    const blockedReferences = React.useMemo(
        () =>
            attachedReferenceUrls.filter((url) => {
                const declaration = declarations[refKey(url)];
                if (!declarationSatisfied(declaration, approvedAuthorizationIds)) return true;
                return refCap <= 1 && referenceRequiresAssetLibrary(url, declaration);
            }),
        [approvedAuthorizationIds, attachedReferenceUrls, declarations, refCap]
    );
    const firstBlockedReference = blockedReferences[0];
    const rawReferenceBlockReason = firstBlockedReference
        ? refCap <= 1 &&
          referenceRequiresAssetLibrary(firstBlockedReference, declarations[refKey(firstBlockedReference)])
            ? ASSET_LIBRARY_MODEL_BLOCK_REASON
            : declarationBlockReason(declarations[refKey(firstBlockedReference)], approvedAuthorizationIds)
        : null;
    const referenceBlockReason = referenceCopy.translateMessage(rawReferenceBlockReason);
    const submitMessage = error ?? notice ?? referenceBlockReason;
    const isBudgetError = Boolean(error && shouldShowBillingAction(error));
    const isInfoMessage = Boolean(
        (!error && Boolean(notice)) ||
            Boolean(
                error &&
                    /^(Added as reference video|Extend loaded|Adjusted for|Adjusted shared settings|Loaded shared settings)/i.test(
                        error
                    )
            )
    );

    const [isInspirationOpen, setIsInspirationOpen] = React.useState(false);
    const [localShotBuilderOpen, setLocalShotBuilderOpen] = React.useState(false);
    const isShotBuilderOpen = storyboardEditorOpen ?? localShotBuilderOpen;
    const setIsShotBuilderOpen = React.useCallback((open: boolean) => { setLocalShotBuilderOpen(open); onStoryboardEditorOpenChange?.(open); }, [onStoryboardEditorOpenChange]);
    const [isOptimizing, setIsOptimizing] = React.useState(false);
    const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);
    const [optimizeError, setOptimizeError] = React.useState<string | null>(null);
    const [isGeneratingShotBatch, setIsGeneratingShotBatch] = React.useState(false);
    const [shotQueue, setShotQueue] = React.useState<ShotQueueItem[]>([]);
    const pendingShotCount = shotQueue.length;
    const shotDraftKey = projectConfig?.id ?? buildProductionSnapshot?.().project.id ?? 'normal';
    const [storyboardDraft, setStoryboardDraft] = React.useState<EditorDraft | undefined>(() => recalledDraft(shotDraftKey));
    const shotQueueScope = React.useMemo<ShotQueueScope>(
        () => ({ projectKey: shotDraftKey, draftSignature: storyboardQueueSignature(storyboardDraft) }),
        [shotDraftKey, storyboardDraft]
    );
    const supportsCameraFixed = activeModel.includes('seedance-1-5');
    const [promptBeforeOptimize, setPromptBeforeOptimize] = React.useState<string | null>(null);
    const [referenceVideoSecondsByUrl, setReferenceVideoSecondsByUrl] = React.useState<Record<string, number>>({});
    const supportsDraftMode = modelSupportsResolution(activeModel, '480p');
    const [generationMode, setGenerationMode] = React.useState<GenerationMode>(() =>
        modelSupportsResolution(activeModel, '480p') ? 'draft' : 'final'
    );
    const referenceLabels = React.useMemo(
        () => referenceLabelsFor(referenceUrls, characters, portraits),
        [characters, portraits, referenceUrls]
    );
    const referenceVideoPreviewUrls = React.useMemo(() => referenceVideoPreviewsFor(portraits), [portraits]);
    useProjectConfig({
        enabled: videoMode === 'drama',
        project: projectConfig,
        setModel,
        setRatio,
        setResolution,
        setVoiceLanguage,
        setCaptionMode,
        setWatermark,
        setWatermarkText
    });

    React.useEffect(() => {
        if (model !== activeModel) {
            setModel(activeModel);
        }
    }, [activeModel, model, setModel]);

    React.useEffect(() => {
        const frame = window.requestAnimationFrame(() => setShotQueue(readShotQueue(shotQueueScope)));
        return () => window.cancelAnimationFrame(frame);
    }, [shotQueueScope]);
    React.useEffect(() => { const frame = window.requestAnimationFrame(() => setStoryboardDraft(recalledDraft(shotDraftKey))); return () => window.cancelAnimationFrame(frame); }, [shotDraftKey]);

    const handleStoryboardDraftChange = React.useCallback(
        (draft: EditorDraft) => {
            const nextDraft = structuredClone(draft);
            rememberDraft(shotDraftKey, nextDraft);
            setStoryboardDraft(nextDraft);
            onStoryboardDraftChange?.(nextDraft);
        },
        [onStoryboardDraftChange, shotDraftKey]
    );

    React.useEffect(() => {
        if (!supportsDraftMode) {
            setGenerationMode('final');
        }
    }, [supportsDraftMode]);

    React.useEffect(() => {
        if (seconds !== activeSeconds) {
            setSeconds(activeSeconds);
        }
    }, [activeSeconds, seconds, setSeconds]);

    React.useEffect(() => {
        if (!supportsCameraFixed && cameraFixed) {
            setCameraFixed(false);
        }
    }, [cameraFixed, setCameraFixed, supportsCameraFixed]);

    const isDraftMode = supportsDraftMode && generationMode === 'draft';
    const activeResolution: VideoResolution = isDraftMode ? '480p' : resolution;
    const hasReferenceVideos = showReferenceVideos && referenceVideoUrls.some((url) => url.trim());
    const inputVideoSeconds = React.useMemo(() => {
        if (!hasReferenceVideos) return 0;
        return referenceVideoUrls.reduce((total, url) => total + (referenceVideoSecondsByUrl[url] ?? 0), 0);
    }, [hasReferenceVideos, referenceVideoSecondsByUrl, referenceVideoUrls]);
    const normalizedVoiceLanguage = normalizeVoiceLanguage(voiceLanguage);
    const normalizedCaptionMode = normalizeCaptionMode(captionMode);
    const normalizedTitleOverlayText = normalizeTitleOverlayText(titleOverlayText);
    const normalizedTitleOverlayStyle = normalizeTitleOverlayStyle(titleOverlayStyle);
    const normalizedTitleOverlayDuration = normalizeTitleOverlayDuration(titleOverlayDuration);
    const normalizedTitleOverlayLanguage = normalizeTitleOverlayLanguage(titleOverlayLanguage);
    const estimatedCost = calculateVideoCost({
        model: activeModel,
        ratio,
        resolution: activeResolution,
        seconds: activeSeconds,
        generateAudio: normalizedVoiceLanguage !== SILENT_VOICE_LANGUAGE,
        inputVideoSeconds
    });
    const isCostLowerBound = Boolean(estimatedCost && (estimatedCost.lowerBound || hasReferenceVideos));
    const showEstimatedCost = Boolean(estimatedCost && prompt.trim() && blockedReferences.length === 0);

    React.useEffect(() => {
        setReferenceVideoSecondsByUrl((current) => {
            const activeUrls = new Set(referenceVideoUrls);
            const next = Object.fromEntries(Object.entries(current).filter(([url]) => activeUrls.has(url)));
            return Object.keys(next).length === Object.keys(current).length ? current : next;
        });
    }, [referenceVideoUrls]);

    const handleOptimize = async () => {
        if (!onOptimizePrompt || !prompt.trim() || isOptimizing) return;
        setIsOptimizing(true);
        setOptimizeError(null);
        try {
            const original = prompt;
            const optimized = await onOptimizePrompt(original);
            setPromptBeforeOptimize(original);
            setPrompt(optimized);
        } catch (err) {
            setOptimizeError(err instanceof Error ? err.message : t('Prompt optimization failed'));
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleUndoOptimize = () => {
        if (promptBeforeOptimize !== null) {
            setPrompt(promptBeforeOptimize);
            setPromptBeforeOptimize(null);
        }
    };

    const handleAttachCharacter = React.useCallback(
        (character: VideoCharacter) => {
            const name = character.name.trim();
            if (!name) return;
            const existingIndex = referenceUrls.indexOf(character.url);
            if (existingIndex === -1 && referenceUrls.length >= refCap) return;

            const imageIndex = existingIndex === -1 ? referenceUrls.length + 1 : existingIndex + 1;
            if (existingIndex === -1) {
                setReferenceUrls([...referenceUrls, character.url]);
            }
            setPrompt((current) => appendCharacterPromptLine(current, imageIndex, name));
            setPromptBeforeOptimize(null);
        },
        [refCap, referenceUrls, setPrompt, setReferenceUrls]
    );

    const handleAttachPortrait = React.useCallback(
        (portrait: VideoPortrait) => {
            const name = portrait.name.trim();
            const referenceUrl = portraitReferenceUrl(portrait.assetId.trim());
            if (!name || referenceUrl === 'asset://') return;
            const existingIndex = referenceUrls.indexOf(referenceUrl);
            if (existingIndex === -1 && referenceUrls.length >= refCap) return;

            const imageIndex = existingIndex === -1 ? referenceUrls.length + 1 : existingIndex + 1;
            if (existingIndex === -1) {
                setReferenceUrls([...referenceUrls, referenceUrl]);
            }
            setPrompt((current) => appendCharacterPromptLine(current, imageIndex, name));
            setPromptBeforeOptimize(null);
        },
        [refCap, referenceUrls, setPrompt, setReferenceUrls]
    );

    const buildSubmissionData = createSubmissionBuilder({
        prompt,
        seconds: activeSeconds,
        model: activeModel,
        ratio,
        resolution: activeResolution,
        finalResolution: resolution,
        draft: isDraftMode,
        voiceLanguage: normalizedVoiceLanguage,
        captionMode: normalizedCaptionMode,
        cameraFixed,
        seed,
        watermark,
        watermarkText,
        titleOverlayEnabled,
        titleOverlayText: normalizedTitleOverlayText,
        titleOverlayStyle: normalizedTitleOverlayStyle,
        titleOverlayDuration: normalizedTitleOverlayDuration,
        titleOverlayLanguage: normalizedTitleOverlayLanguage,
        referenceUrls,
        referenceCap: refCap,
        lastFrameUrl,
        referenceAudioUrl,
        showReferenceAudio,
        referenceVideoUrls,
        referenceVideoSecondsByUrl,
        showReferenceVideos,
        buildProductionSnapshot: videoMode === 'drama' ? buildProductionSnapshot : undefined
    });

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (blockedReferences.length > 0) return;
        void onSubmit(buildSubmissionData());
    };
    const updateShotQueue = (nextQueue: ShotQueueItem[]) => {
        setShotQueue(nextQueue);
        writeShotQueue(nextQueue, shotQueueScope);
    };

    const processShotQueue = async (initialQueue = shotQueue) => {
        if (blockedReferences.length > 0 || isGeneratingShotBatch) return;
        let remaining = initialQueue.slice(0, SHOT_GENERATION_BATCH_LIMIT);
        const deferred = initialQueue.slice(SHOT_GENERATION_BATCH_LIMIT);
        if (remaining.length === 0) return;
        setIsGeneratingShotBatch(true);
        try {
            while (remaining.length > 0) {
                const item = remaining[0];
                const shotIndex = item.data.episode_shot?.shotIndex;
                const replacesItemId = shotIndex
                    ? shotVideoPreviews?.find((preview) => preview.shotIndex === shotIndex)?.jobId
                    : undefined;
                await onSubmit(item.data, { title: item.title, replacesItemId, rethrowOnError: true, onSubmitStage: () => undefined });
                remaining = remaining.slice(1);
                setShotQueue([...remaining, ...deferred]);
            }
        } finally {
            setIsGeneratingShotBatch(false);
        }
    };

    const handleGenerateShot = async (shot: EditorDraft['shots'][number], index: number) => {
        if (!storyboardDraft || blockedReferences.length > 0 || isGeneratingShotBatch || !shot.description.trim()) return;
        const queue = storyboardVideoQueueItems({ draft: storyboardDraft, shots: [{ shot, index }], activeSeconds, activeModel, buildSubmissionData, titleForShot: (itemIndex) => t('Shot <lcur>number<rcur>', { number: itemIndex + 1 }) });
        updateShotQueue(queue);
        await processShotQueue(queue);
    };

    const handleGenerateAllShots = async () => {
        if (!storyboardDraft || blockedReferences.length > 0 || isGeneratingShotBatch) return;
        const queue = storyboardDraft.shots
            .map((shot, index) => ({ shot, index }))
            .filter(({ shot }) => shot.description.trim());
        const items = storyboardVideoQueueItems({ draft: storyboardDraft, shots: queue, activeSeconds, activeModel, buildSubmissionData, titleForShot: (index) => t('Shot <lcur>number<rcur>', { number: index + 1 }) });
        if (items.length === 0) return;
        updateShotQueue(items);
        await processShotQueue(items);
    };
    const sceneAssetAutobind = useSceneAssetAutobind({ draft: storyboardDraft, onAutoBind: onAutoBindSceneAssets, onDraftChange: handleStoryboardDraftChange });

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex items-start justify-between border-b border-white/10 pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-medium text-white'>{t('Create Video')}</CardTitle>
                    </div>
                    <CardDescription className='mt-1 text-white/60'>
                        {t('Generate a video with Xcity Studio')}
                    </CardDescription>
                </div>
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent data-creation-form-scroll className='flex-1 space-y-5 overflow-y-auto p-4'>
                    <ShotBuilderDialog
                        key={shotDraftKey}
                        draftKey={shotDraftKey}
                        isOpen={isShotBuilderOpen && videoMode === 'drama'}
                        onOpenChange={setIsShotBuilderOpen}
                        referenceCount={referenceUrls.length}
                        referenceLabels={referenceLabels}
                        onBreakdownScript={onBreakdownScript}
                        onDraftChange={handleStoryboardDraftChange}
                        projectAssets={projectAssets}
                        defaultDurationSeconds={activeSeconds}
                        minDurationSeconds={minSeconds}
                        maxDurationSeconds={maxSeconds}
                        isGeneratingShots={isGeneratingShotBatch || isLoading}
                    />
                    {videoMode === 'drama' ? (
                        <DramaLaunchPanel
                            disabled={isLoading}
                            onOpen={() => setIsShotBuilderOpen(true)}
                            projectControls={projectControls}
                            storyboardDraft={storyboardDraft}
                            projectAssets={projectAssets}
                            onOpenAssets={onOpenAssets ? () => onOpenAssets() : undefined}
                            onDraftChange={handleStoryboardDraftChange}
                            onGenerateShot={handleGenerateShot}
                            onGenerateAllShots={handleGenerateAllShots}
                            isGeneratingShot={isGeneratingShotBatch || isLoading}
                            pendingShotCount={pendingShotCount}
                            shotVideoPreviews={shotVideoPreviews}
                            onContinueShotQueue={() => void processShotQueue()}
                            onAutoBindSceneAssets={sceneAssetAutobind.run} isAutoBindingSceneAssets={sceneAssetAutobind.busy} sceneAssetBindingError={sceneAssetAutobind.error} sceneAssetBindingProgress={sceneAssetAutobind.progress}
                        />
                    ) : (
                        <>
                            <div className='space-y-1.5'>
                                <div className='flex flex-wrap items-center justify-between gap-2'>
                                    <Label htmlFor='prompt' className='text-white'>
                                        {t('Prompt')}
                                    </Label>
                                    <div className='flex flex-wrap items-center justify-end gap-1'>
                                        {promptBeforeOptimize !== null && (
                                            <button
                                                type='button'
                                                onClick={handleUndoOptimize}
                                                className='flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white'>
                                                <Undo2 className='h-3 w-3' />
                                                {t('Undo')}
                                            </button>
                                        )}
                                        <button
                                            type='button'
                                            onClick={() => setIsInspirationOpen(true)}
                                            disabled={isLoading}
                                            className='flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white'>
                                            <Lightbulb className='h-3 w-3' />
                                            {t('Inspiration')}
                                        </button>
                                        {onOptimizePrompt && (
                                            <button
                                                type='button'
                                                onClick={() => void handleOptimize()}
                                                disabled={isLoading || isOptimizing || !prompt.trim()}
                                                className='flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                                {isOptimizing ? (
                                                    <Loader2 className='h-3 w-3 animate-spin' />
                                                ) : (
                                                    <Wand2 className='h-3 w-3' />
                                                )}
                                                {isOptimizing ? t('Optimizing<hellip>') : t('AI Optimize')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <Textarea
                                    id='prompt'
                                    placeholder={t(
                                        'e<dot>g<dot><comma> Wide shot of a child flying a red kite in a grassy park<comma> golden hour sunlight<comma> camera slowly pans upward'
                                    )}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    className='[field-sizing:fixed] h-56 min-h-36 resize-none overflow-y-auto rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                />
                                {CAMERA_TEMPLATES.length > 0 && (
                                    <div className='flex items-center gap-2 overflow-hidden'>
                                        <span className='shrink-0 text-xs text-white/40'>{t('Camera<colon>')}</span>
                                        <div className='flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1'>
                                            {CAMERA_TEMPLATES.map((template) => (
                                                <button
                                                    key={template.label}
                                                    type='button'
                                                    onClick={() => {
                                                        setPrompt((current) => applyPromptTemplate(current, template));
                                                        setPromptBeforeOptimize(null);
                                                    }}
                                                    disabled={isLoading}
                                                    title={template.text}
                                                    className='shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                                    {templateLabel(template.label)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {optimizeError && <InlineError>{optimizeError}</InlineError>}
                                <p className='text-xs text-white/40'>
                                    {t(
                                        'Describe<colon> shot type<comma> subject<comma> action<comma> setting<comma> and lighting for best results'
                                    )}
                                </p>
                            </div>

                            <PromptInspirationDialog
                                isOpen={isInspirationOpen}
                                onOpenChange={setIsInspirationOpen}
                                onPick={(template) => {
                                    setPrompt((current) => applyPromptTemplate(current, template));
                                    setPromptBeforeOptimize(null);
                                    if (template.mode === 'replace') {
                                        setIsInspirationOpen(false);
                                    }
                                }}
                            />
                            <div className='space-y-2'>
                                <Label htmlFor='model-select' className='text-white'>
                                    {t('Model')}
                                </Label>
                                <Dropdown
                                    id='model-select'
                                    value={activeModel}
                                    onValueChange={(value) => {
                                        const newModel = value as VideoModel;
                                        onClearNotice?.();
                                        setModel((current) => (current === newModel ? current : newModel));
                                        if (!modelSupportsResolution(newModel, resolution)) {
                                            setResolution('720p');
                                        }
                                        setSeconds((prev) => {
                                            const next = clampSeconds(prev, newModel);
                                            return next === prev ? prev : next;
                                        });
                                        setReferenceUrls((prev) => {
                                            const maxImages = maxReferenceImages(newModel);
                                            return prev.length > maxImages ? prev.slice(0, maxImages) : prev;
                                        });
                                    }}
                                    disabled={isLoading}
                                    options={creationOptions.models}
                                />
                            </div>

                            <div className='grid grid-cols-2 gap-4'>
                                <div className='space-y-2'>
                                    <Label htmlFor='ratio-select' className='text-white'>
                                        {t('Aspect Ratio')}
                                    </Label>
                                    {/* With a reference image the provider derives the ratio
                                from the image and rejects an explicit one. */}
                                    <Dropdown
                                        id='ratio-select'
                                        value={ratio}
                                        onValueChange={(value) => setRatio(value as VideoRatio)}
                                        disabled={isLoading || isFirstFrameMode}
                                        options={creationOptions.ratios}
                                    />
                                    {isFirstFrameMode && (
                                        <p className='text-xs text-white/40'>{t('Follows the reference image')}</p>
                                    )}
                                </div>

                                <div className='space-y-2'>
                                    <Label htmlFor='resolution-select' className='text-white'>
                                        {t('Resolution')}
                                    </Label>
                                    <Dropdown
                                        id='resolution-select'
                                        value={resolution}
                                        onValueChange={(value) => setResolution(value as VideoResolution)}
                                        disabled={isLoading}
                                        options={RESOLUTIONS.map((resolutionOption) => ({
                                            value: resolutionOption,
                                            label: `${resolutionOption}${
                                                !modelSupportsResolution(activeModel, resolutionOption)
                                                    ? ` · ${t('not supported')}`
                                                    : ''
                                            }`,
                                            disabled: !modelSupportsResolution(activeModel, resolutionOption)
                                        }))}
                                    />
                                </div>
                            </div>

                            <div className='space-y-2'>
                                <div className='flex items-center justify-between'>
                                    <Label className='text-white'>{t('Duration')}</Label>
                                    <span className='text-sm text-white/60'>
                                        {t('<lcur>seconds<rcur> seconds', { seconds: activeSeconds })}
                                    </span>
                                </div>
                                <input
                                    type='range'
                                    min={minSeconds}
                                    max={maxSeconds}
                                    step={1}
                                    value={activeSeconds}
                                    onChange={(event) =>
                                        setSeconds(clampSeconds(Number(event.target.value), activeModel))
                                    }
                                    disabled={isLoading}
                                    className={nativeRangeClass}
                                />
                                <p className='text-xs text-white/40'>
                                    {t('<lcur>model<rcur> clips run <lcur>min<rcur><dash><lcur>max<rcur> seconds', {
                                        model: modelDef?.label ?? 'Seedance',
                                        min: minSeconds,
                                        max: maxSeconds
                                    })}
                                </p>
                            </div>

                            <div className='grid gap-4 sm:grid-cols-2'>
                                <div className='space-y-2'>
                                    <Label htmlFor='voice-language-select' className='text-white'>
                                        {t('Voice')}
                                    </Label>
                                    <Dropdown
                                        id='voice-language-select'
                                        value={normalizedVoiceLanguage}
                                        onValueChange={setVoiceLanguage}
                                        disabled={isLoading}
                                        options={creationOptions.voices}
                                    />
                                </div>
                                {supportsCameraFixed && (
                                    <div className='space-y-2'>
                                        <Label className='text-white'>{t('Camera')}</Label>
                                        <div className='flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3'>
                                            <input
                                                type='checkbox'
                                                id='camera-fixed'
                                                checked={cameraFixed}
                                                onChange={(event) => setCameraFixed(event.target.checked)}
                                                disabled={isLoading}
                                                className={nativeCheckboxClass}
                                            />
                                            <Label htmlFor='camera-fixed' className='cursor-pointer text-white/80'>
                                                {t('Fixed camera')}
                                            </Label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className='rounded-md border border-white/10 bg-white/[0.03]'>
                                <button
                                    type='button'
                                    onClick={() => setIsAdvancedOpen((open) => !open)}
                                    className='flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/5'
                                    aria-expanded={isAdvancedOpen}>
                                    <span>{t('Advanced')}</span>
                                    <ChevronDown
                                        className={cn(
                                            'h-4 w-4 text-white/50 transition-transform',
                                            isAdvancedOpen && 'rotate-180'
                                        )}
                                    />
                                </button>
                                {isAdvancedOpen && (
                                    <div className='space-y-4 border-t border-white/10 p-3'>
                                        <div className='space-y-2'>
                                            <div className='flex items-center gap-1.5'>
                                                <Label htmlFor='seed-input' className='text-white/80'>
                                                    {t('Seed')}
                                                </Label>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type='button'
                                                            className='text-white/45 transition-colors hover:text-white/80'
                                                            aria-label={t('Seed help')}>
                                                            <HelpCircle className='h-3.5 w-3.5' />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side='top'
                                                        className='max-w-64 border border-white/20 bg-black text-white'>
                                                        {t(
                                                            'Use a seed to reproduce settings<dot> Leave it random unless you want to revisit a result'
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <Input
                                                id='seed-input'
                                                type='number'
                                                step={1}
                                                inputMode='numeric'
                                                placeholder={t('Random')}
                                                value={seed ?? ''}
                                                onChange={(e) => {
                                                    const value = e.target.value.trim();
                                                    if (!value) {
                                                        setSeed(undefined);
                                                        return;
                                                    }
                                                    const parsed = Number(value);
                                                    if (Number.isFinite(parsed)) {
                                                        setSeed(Math.trunc(parsed));
                                                    }
                                                }}
                                                disabled={isLoading}
                                                className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                            />
                                        </div>
                                        <div className='flex items-center space-x-2'>
                                            <input
                                                type='checkbox'
                                                id='watermark'
                                                checked={watermark}
                                                onChange={(event) => setWatermark(event.target.checked)}
                                                disabled={isLoading}
                                                className={nativeCheckboxClass}
                                            />
                                            <div className='flex items-center gap-1.5'>
                                                <Label htmlFor='watermark' className='cursor-pointer text-white/80'>
                                                    {t('Watermark')}
                                                </Label>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type='button'
                                                            className='text-white/45 transition-colors hover:text-white/80'
                                                            aria-label={t('Watermark help')}>
                                                            <HelpCircle className='h-3.5 w-3.5' />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side='top'
                                                        className='max-w-64 border border-white/20 bg-black text-white'>
                                                        {t(
                                                            'Adds a small visible mark in the bottom<dash>right after generation<dot> Use the field below to customize the text'
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        {watermark && (
                                            <div className='space-y-1'>
                                                <Label htmlFor='watermark-text' className='text-xs text-white/60'>
                                                    {t('Watermark text')}
                                                </Label>
                                                <Input
                                                    id='watermark-text'
                                                    type='text'
                                                    value={watermarkText}
                                                    maxLength={100}
                                                    onChange={(e) => setWatermarkText(e.target.value.slice(0, 100))}
                                                    disabled={isLoading}
                                                    placeholder={t('generated by xcity ai studio')}
                                                    className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                                />
                                                <div className='text-[10px] text-white/35'>
                                                    {watermarkText.length}/100
                                                </div>
                                            </div>
                                        )}
                                        <div className='flex items-center space-x-2'>
                                            <input
                                                type='checkbox'
                                                id='title-overlay'
                                                checked={titleOverlayEnabled}
                                                onChange={(event) => setTitleOverlayEnabled(event.target.checked)}
                                                disabled={isLoading}
                                                className={nativeCheckboxClass}
                                            />
                                            <div className='flex items-center gap-1.5'>
                                                <Label htmlFor='title-overlay' className='cursor-pointer text-white/80'>
                                                    {t('Title overlay')}
                                                </Label>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type='button'
                                                            className='text-white/45 transition-colors hover:text-white/80'
                                                            aria-label={t('Title overlay help')}>
                                                            <HelpCircle className='h-3.5 w-3.5' />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side='top'
                                                        className='max-w-64 border border-white/20 bg-black text-white'>
                                                        {t(
                                                            'Adds a centered title at the start of the video<comma> then removes it before subtitles appear'
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        {titleOverlayEnabled && (
                                            <div className='space-y-3 rounded-md border border-white/10 bg-black/40 p-3'>
                                                <div className='space-y-1'>
                                                    <Label
                                                        htmlFor='title-overlay-text'
                                                        className='text-xs text-white/60'>
                                                        {t('Title text')}
                                                    </Label>
                                                    <Input
                                                        id='title-overlay-text'
                                                        type='text'
                                                        value={titleOverlayText}
                                                        maxLength={MAX_TITLE_OVERLAY_TEXT_LENGTH}
                                                        onChange={(event) =>
                                                            setTitleOverlayText(
                                                                event.target.value.slice(
                                                                    0,
                                                                    MAX_TITLE_OVERLAY_TEXT_LENGTH
                                                                )
                                                            )
                                                        }
                                                        disabled={isLoading}
                                                        placeholder={t('Opening title')}
                                                        className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                                    />
                                                    <div className='text-[10px] text-white/35'>
                                                        {normalizedTitleOverlayText.length}/
                                                        {MAX_TITLE_OVERLAY_TEXT_LENGTH}
                                                    </div>
                                                </div>
                                                <div className='grid gap-3 sm:grid-cols-3'>
                                                    <div className='space-y-1'>
                                                        <Label
                                                            htmlFor='title-overlay-style'
                                                            className='text-xs text-white/60'>
                                                            {t('Style')}
                                                        </Label>
                                                        <Dropdown
                                                            id='title-overlay-style'
                                                            value={normalizedTitleOverlayStyle}
                                                            onValueChange={setTitleOverlayStyle}
                                                            disabled={isLoading}
                                                            options={creationOptions.titleStyles}
                                                        />
                                                    </div>
                                                    <div className='space-y-1'>
                                                        <Label
                                                            htmlFor='title-overlay-language'
                                                            className='text-xs text-white/60'>
                                                            {t('Language')}
                                                        </Label>
                                                        <Dropdown
                                                            id='title-overlay-language'
                                                            value={normalizedTitleOverlayLanguage}
                                                            onValueChange={setTitleOverlayLanguage}
                                                            disabled={isLoading}
                                                            options={creationOptions.titleLanguages}
                                                        />
                                                    </div>
                                                    <div className='space-y-1'>
                                                        <Label
                                                            htmlFor='title-overlay-duration'
                                                            className='text-xs text-white/60'>
                                                            {t('Timing')}
                                                        </Label>
                                                        <Dropdown
                                                            id='title-overlay-duration'
                                                            value={normalizedTitleOverlayDuration}
                                                            onValueChange={setTitleOverlayDuration}
                                                            disabled={isLoading}
                                                            options={creationOptions.titleDurations}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className='space-y-2'>
                                            <div className='flex items-center gap-1.5'>
                                                <Label htmlFor='caption-mode-select' className='text-white/80'>
                                                    {t('Subtitles')}
                                                </Label>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type='button'
                                                            className='text-white/45 transition-colors hover:text-white/80'
                                                            aria-label={t('Subtitles help')}>
                                                            <HelpCircle className='h-3.5 w-3.5' />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side='top'
                                                        className='max-w-64 border border-white/20 bg-black text-white'>
                                                        {t(
                                                            'Controls subtitle language through the Seedance prompt<dot> Choose None for no subtitles'
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <Dropdown
                                                id='caption-mode-select'
                                                value={normalizedCaptionMode}
                                                onValueChange={setCaptionMode}
                                                disabled={isLoading}
                                                options={creationOptions.captions}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <CharacterSelectors
                                characters={characters}
                                portraits={portraits}
                                virtualCharacterGroups={virtualCharacterGroups}
                                referenceUrls={referenceUrls}
                                referenceLimit={refCap}
                                disabled={isLoading}
                                onAttachCharacter={handleAttachCharacter}
                                onAttachPortrait={handleAttachPortrait}
                            />

                            <ReferenceImagesInput
                                urls={referenceUrls}
                                onChange={setReferenceUrls}
                                maxImages={refCap}
                                lastFrameUrl={lastFrameUrl}
                                onLastFrameChange={setLastFrameUrl}
                                onUpload={onUploadImage}
                                declarations={declarations}
                                onDeclare={onDeclareReference}
                                approvedAuthorizationIds={approvedAuthorizationIds}
                                onOpenAssets={onOpenAssets}
                                portraits={portraits}
                                showCharacters={false}
                                onReviewReferenceAsset={onReviewReferenceAsset}
                                onSwitchToAssetModel={() => setModel(DEFAULT_VIDEO_REFERENCE_MODEL)}
                                disabled={isLoading}
                            />
                            {showReferenceAudio && (
                                <ReferenceAudioInput
                                    url={referenceAudioUrl}
                                    onChange={setReferenceAudioUrl}
                                    onUpload={onUploadAudio}
                                    onSynthesizeSpeech={onSynthesizeSpeech}
                                    disabled={isLoading}
                                />
                            )}
                            {showReferenceVideos && (
                                <ReferenceVideosInput
                                    urls={referenceVideoUrls}
                                    onChange={setReferenceVideoUrls}
                                    resolvePreviewUrl={(url) => referenceVideoPreviewUrls.get(url) ?? url}
                                    onDurationChange={(url, duration) => {
                                        setReferenceVideoSecondsByUrl((current) => ({ ...current, [url]: duration }));
                                    }}
                                    onUpload={onUploadVideo}
                                    disabled={isLoading}
                                />
                            )}
                        </>
                    )}
                </CardContent>
                {videoMode === 'normal' && (
                    <CardFooter className='flex flex-col gap-3 border-t border-white/10 p-4'>
                        <div
                            className='flex w-full rounded-md border border-white/15 bg-white/[0.03] p-1'
                            aria-label={t('Generation quality')}>
                            {supportsDraftMode && (
                                <button
                                    type='button'
                                    onClick={() => setGenerationMode('draft')}
                                    disabled={isLoading}
                                    aria-pressed={isDraftMode}
                                    className={cn(
                                        'flex-1 rounded px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                                        isDraftMode
                                            ? 'bg-white text-black'
                                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                                    )}>
                                    {t('Draft')} · 480p
                                </button>
                            )}
                            <button
                                type='button'
                                onClick={() => setGenerationMode('final')}
                                disabled={isLoading}
                                aria-pressed={!isDraftMode}
                                className={cn(
                                    'rounded px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                                    supportsDraftMode ? 'flex-1' : 'w-full',
                                    !isDraftMode
                                        ? 'bg-white text-black'
                                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                                )}>
                                {t('Final')} · {resolution}
                            </button>
                        </div>
                        <Button
                            type='submit'
                            disabled={isLoading || !prompt.trim() || blockedReferences.length > 0}
                            className='w-full bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                            {isLoading ? (
                                <>
                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    {t('Creating Video<hellip>')}
                                </>
                            ) : (
                                <>
                                    <Sparkles className='mr-2 h-4 w-4' />
                                    {t('Create Video')}
                                </>
                            )}
                        </Button>
                        {showEstimatedCost && estimatedCost && (
                            <p className='w-full truncate text-xs whitespace-nowrap text-white/60'>
                                {isCostLowerBound
                                    ? t(
                                          'Next video estimate<colon> from <usd><lcur>cost<rcur> <mdash> charged only after success',
                                          {
                                              cost: estimatedCost.totalCost.toFixed(2)
                                          }
                                      )
                                    : t(
                                          'Next video estimate<colon> <usd><lcur>cost<rcur> <mdash> charged only after success',
                                          {
                                              cost: estimatedCost.totalCost.toFixed(2)
                                          }
                                      )}
                            </p>
                        )}
                        {submitMessage && (
                            <div
                                role='alert'
                                className={cn(
                                    'w-full rounded-md border px-3 py-2 text-sm',
                                    isInfoMessage
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                                        : error
                                          ? 'border-red-500/40 bg-red-500/10 text-red-200'
                                          : 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                                )}>
                                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                                    <span className='min-w-0 break-words'>{submitMessage}</span>
                                    {isBudgetError && (
                                        <Button
                                            asChild
                                            size='sm'
                                            className='w-full bg-white text-black hover:bg-white/90 sm:w-auto'>
                                            <a href={XCITY_BILLING_URL}>
                                                <CreditCard className='h-4 w-4' />
                                                {t('Billing')}
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardFooter>
                )}
            </form>
        </Card>
    );
}
