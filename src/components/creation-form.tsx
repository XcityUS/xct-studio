'use client';

import { PromptInspirationDialog } from '@/components/prompt-inspiration';
import { ReferenceAudioInput } from '@/components/reference-audio-input';
import { ReferenceImagesInput } from '@/components/reference-images-input';
import { ReferenceVideosInput } from '@/components/reference-videos-input';
import { ShotBuilderDialog, type ShotDraft } from '@/components/shot-builder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { VideoCharacter, VideoPortrait } from '@/hooks/use-video-history';
import { XCITY_BILLING_URL, shouldShowBillingAction } from '@/lib/billing';
import { calculateVideoCost } from '@/lib/cost-utils';
import {
    CAPTION_MODE_OPTIONS,
    SILENT_VOICE_LANGUAGE,
    VOICE_LANGUAGE_OPTIONS,
    normalizeCaptionMode,
    normalizeVoiceLanguage
} from '@/lib/prompt-guards';
import { PROMPT_TEMPLATE_CATEGORIES, applyPromptTemplate } from '@/lib/prompt-templates';
import {
    ASSET_LIBRARY_MODEL_BLOCK_REASON,
    declarationBlockReason,
    declarationSatisfied,
    refKey,
    referenceRequiresAssetLibrary,
    type ReferenceDeclaration,
    type ReferenceOrigin
} from '@/lib/reference-origin';
import {
    DEFAULT_MODEL,
    RATIOS,
    RESOLUTIONS,
    SEEDANCE_MODELS,
    clampSeconds,
    getSeedanceModel,
    maxReferenceImages,
    modelSupportsResolution,
    secondsRange,
    type VideoModel,
    type VideoRatio,
    type VideoResolution
} from '@/lib/seedance';
import type { TtsVoice } from '@/lib/tts';
import { cn } from '@/lib/utils';
import type { VideoJobCreate } from '@/types/video';
import {
    AlertCircle,
    ChevronDown,
    Clapperboard,
    CreditCard,
    HelpCircle,
    Lightbulb,
    Loader2,
    ShieldCheck,
    Sparkles,
    Undo2,
    Wand2
} from 'lucide-react';
import * as React from 'react';

export type CreationFormData = VideoJobCreate;

type CreationFormProps = {
    onSubmit: (data: CreationFormData) => void;
    isLoading: boolean;
    model: VideoModel;
    setModel: React.Dispatch<React.SetStateAction<VideoModel>>;
    prompt: string;
    setPrompt: React.Dispatch<React.SetStateAction<string>>;
    ratio: VideoRatio;
    setRatio: React.Dispatch<React.SetStateAction<VideoRatio>>;
    resolution: VideoResolution;
    setResolution: React.Dispatch<React.SetStateAction<VideoResolution>>;
    seconds: number;
    setSeconds: React.Dispatch<React.SetStateAction<number>>;
    cameraFixed: boolean;
    setCameraFixed: React.Dispatch<React.SetStateAction<boolean>>;
    referenceUrls: string[];
    setReferenceUrls: React.Dispatch<React.SetStateAction<string[]>>;
    declarations: Record<string, ReferenceDeclaration>;
    onDeclareReference: (url: string, origin: ReferenceOrigin) => void;
    approvedAuthorizationIds: ReadonlySet<string>;
    characters: VideoCharacter[];
    portraits: VideoPortrait[];
    lastFrameUrl: string;
    setLastFrameUrl: React.Dispatch<React.SetStateAction<string>>;
    referenceAudioUrl: string;
    setReferenceAudioUrl: React.Dispatch<React.SetStateAction<string>>;
    referenceVideoUrls: string[];
    setReferenceVideoUrls: React.Dispatch<React.SetStateAction<string[]>>;
    seed: number | undefined;
    setSeed: React.Dispatch<React.SetStateAction<number | undefined>>;
    watermark: boolean;
    setWatermark: React.Dispatch<React.SetStateAction<boolean>>;
    watermarkText: string;
    setWatermarkText: React.Dispatch<React.SetStateAction<string>>;
    voiceLanguage: string;
    setVoiceLanguage: React.Dispatch<React.SetStateAction<string>>;
    captionMode: string;
    setCaptionMode: React.Dispatch<React.SetStateAction<string>>;
    /** Uploads a local image, resolving to its public URL. Absent = URL-only mode. */
    onUploadImage?: (file: File) => Promise<string>;
    /** Uploads a local audio file, resolving to its public URL. Absent = URL-only mode. */
    onUploadAudio?: (file: File) => Promise<string>;
    /** Generates speech, uploads it, and resolves to its public URL. */
    onSynthesizeSpeech?: (text: string, voice: TtsVoice) => Promise<string>;
    /** Uploads a local video file, resolving to its public URL. Absent = URL-only mode. */
    onUploadVideo?: (file: File) => Promise<string>;
    /** Creates a BytePlus virtual-character asset from a reference image and returns asset://... */
    onCreateVirtualAsset?: (input: { url: string; name: string }) => Promise<string>;
    /** Rewrites the prompt via the gateway's chat API. Absent = button hidden. */
    onOptimizePrompt?: (prompt: string) => Promise<string>;
    /** Splits a script into Seedance shot rows via the gateway's chat API. */
    onBreakdownScript?: (script: string) => Promise<ShotDraft[]>;
    /** Opens the Assets tab for portrait-library setup. */
    onOpenAssets?: (referenceKey?: string) => void;
    /** Message from the last submission — rendered under the Create button. */
    error?: string | null;
};

const RATIO_LABELS: Record<VideoRatio, string> = {
    '16:9': '16:9 · Landscape',
    '9:16': '9:16 · Portrait',
    '1:1': '1:1 · Square',
    '4:3': '4:3 · Classic',
    '21:9': '21:9 · Cinematic'
};

const CAMERA_TEMPLATES = PROMPT_TEMPLATE_CATEGORIES.find((category) => category.id === 'camera')?.templates ?? [];
type GenerationMode = 'draft' | 'final';
const nativeSelectClass =
    'h-10 w-full rounded-md border border-white/20 bg-black px-3 text-sm text-white outline-none focus:border-white/50 focus:ring-2 focus:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50';

function InlineError({ children }: { children: React.ReactNode }) {
    return (
        <div
            role='alert'
            className='flex w-full items-start gap-2 rounded-md border border-red-400/25 bg-red-500/[0.08] px-3 py-2 text-xs leading-5 text-red-200'>
            <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-red-300' />
            <span className='min-w-0 break-words'>{children}</span>
        </div>
    );
}

function appendCharacterPromptLine(prompt: string, imageIndex: number, name: string): string {
    const line = `[Image ${imageIndex}] is ${name}.`;
    const trimmed = prompt.trimEnd();
    return trimmed ? `${trimmed}\n${line}` : line;
}

function portraitReferenceUrl(assetId: string): string {
    return `asset://${assetId}`;
}

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
    onUploadImage,
    onUploadAudio,
    onSynthesizeSpeech,
    onUploadVideo,
    onCreateVirtualAsset,
    onOptimizePrompt,
    onBreakdownScript,
    onOpenAssets,
    error
}: CreationFormProps) {
    const activeModel = getSeedanceModel(model) ? model : DEFAULT_MODEL;
    const { min: minSeconds, max: maxSeconds } = secondsRange(activeModel);
    const modelDef = getSeedanceModel(activeModel);
    const refCap = maxReferenceImages(activeModel);
    // Ratio is provider-derived only in first-frame mode (exactly one image).
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
    const referenceBlockReason = firstBlockedReference
        ? refCap <= 1 &&
          referenceRequiresAssetLibrary(firstBlockedReference, declarations[refKey(firstBlockedReference)])
            ? ASSET_LIBRARY_MODEL_BLOCK_REASON
            : declarationBlockReason(declarations[refKey(firstBlockedReference)], approvedAuthorizationIds)
        : null;
    const submitMessage = error ?? referenceBlockReason;
    const isBudgetError = Boolean(error && shouldShowBillingAction(error));
    const isInfoMessage = Boolean(
        error && /^(Added as reference video|Extend loaded|Adjusted for|Adjusted shared settings|Loaded shared settings)/i.test(error)
    );

    const [isInspirationOpen, setIsInspirationOpen] = React.useState(false);
    const [isShotBuilderOpen, setIsShotBuilderOpen] = React.useState(false);
    const [isOptimizing, setIsOptimizing] = React.useState(false);
    const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);
    const [optimizeError, setOptimizeError] = React.useState<string | null>(null);
    const supportsCameraFixed = !activeModel.includes('seedance-2-5');
    // The prompt as it was before the last AI rewrite, so Undo can restore it.
    const [promptBeforeOptimize, setPromptBeforeOptimize] = React.useState<string | null>(null);
    const [referenceVideoSecondsByUrl, setReferenceVideoSecondsByUrl] = React.useState<Record<string, number>>({});
    const supportsDraftMode = modelSupportsResolution(activeModel, '480p');
    const [generationMode, setGenerationMode] = React.useState<GenerationMode>(() =>
        modelSupportsResolution(activeModel, '480p') ? 'draft' : 'final'
    );
    const referenceLabels = React.useMemo(() => {
        const labelsByUrl = new Map<string, string>([
            ...characters.map((character) => [character.url, character.name] as const),
            ...portraits.map((portrait) => [portraitReferenceUrl(portrait.assetId), portrait.name] as const)
        ]);
        return referenceUrls.map((url) => labelsByUrl.get(url) ?? null);
    }, [characters, portraits, referenceUrls]);
    const verifiedPortraits = React.useMemo(
        () => portraits.filter((portrait) => portrait.groupType === 'LivenessFace'),
        [portraits]
    );
    const virtualPortraits = React.useMemo(
        () => portraits.filter((portrait) => portrait.groupType === 'AIGC'),
        [portraits]
    );

    React.useEffect(() => {
        if (model !== activeModel) {
            setModel(activeModel);
        }
    }, [activeModel, model, setModel]);

    React.useEffect(() => {
        if (!supportsDraftMode) {
            setGenerationMode('final');
        }
    }, [supportsDraftMode]);

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
    const estimatedCost = calculateVideoCost({
        model: activeModel,
        ratio,
        resolution: activeResolution,
        seconds,
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
            setOptimizeError(err instanceof Error ? err.message : 'Prompt optimization failed.');
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

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (blockedReferences.length > 0) return;
        const formData: CreationFormData = {
            model: activeModel,
            prompt,
            ratio,
            resolution: activeResolution,
            seconds,
            generate_audio: normalizedVoiceLanguage !== SILENT_VOICE_LANGUAGE,
            camera_fixed: cameraFixed,
            seed,
            watermark,
            watermarkText: watermark ? watermarkText.trim().slice(0, 100) : undefined,
            avoid_generated_captions: normalizedCaptionMode === 'none',
            voice_language: normalizedVoiceLanguage,
            caption_mode: normalizedCaptionMode
        };
        if (isDraftMode) {
            formData.draft = true;
            formData.final_resolution = resolution;
        }
        const refs = referenceUrls.map((u) => u.trim()).filter(Boolean);
        const videos = showReferenceVideos ? referenceVideoUrls.map((u) => u.trim()).filter(Boolean) : [];
        if (refs.length === 1) {
            formData.input_reference_url = refs[0];
            const lastFrame = lastFrameUrl.trim();
            if (lastFrame) {
                formData.last_frame_url = lastFrame;
            }
        } else if (refs.length > 1) {
            formData.reference_image_urls = refs;
            const audio = referenceAudioUrl.trim();
            if (showReferenceAudio && audio) {
                formData.reference_audio_url = audio;
            }
        }
        if (videos.length) {
            formData.reference_video_urls = videos.slice(0, 2);
            formData.reference_video_seconds = formData.reference_video_urls.map(
                (url) => referenceVideoSecondsByUrl[url] ?? 0
            );
            if (refs.length === 1) {
                formData.omni_reference_task_type = 'extend';
                formData.omit_resolution = true;
                formData.omit_ratio = true;
                formData.camera_fixed = undefined;
            }
        }
        onSubmit(formData);
    };

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex items-start justify-between border-b border-white/10 pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-medium text-white'>Create Video</CardTitle>
                    </div>
                    <CardDescription className='mt-1 text-white/60'>
                        Generate a video with ByteDance Seedance via Xcity TokenHub.
                    </CardDescription>
                </div>
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent
                    data-creation-form-scroll
                    className='flex-1 space-y-5 overflow-y-auto p-4 lg:overflow-visible'>
                    <div className='space-y-1.5'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <Label htmlFor='prompt' className='text-white'>
                                Prompt
                            </Label>
                            <div className='flex flex-wrap items-center justify-end gap-1'>
                                {promptBeforeOptimize !== null && (
                                    <button
                                        type='button'
                                        onClick={handleUndoOptimize}
                                        className='flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white'>
                                        <Undo2 className='h-3 w-3' />
                                        Undo
                                    </button>
                                )}
                                <button
                                    type='button'
                                    onClick={() => setIsInspirationOpen(true)}
                                    disabled={isLoading}
                                    className='flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white'>
                                    <Lightbulb className='h-3 w-3' />
                                    Inspiration
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setIsShotBuilderOpen(true)}
                                    disabled={isLoading}
                                    className='flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white'>
                                    <Clapperboard className='h-3 w-3' />
                                    Shots
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
                                        {isOptimizing ? 'Optimizing…' : 'AI Optimize'}
                                    </button>
                                )}
                            </div>
                        </div>
                        <Textarea
                            id='prompt'
                            placeholder='e.g., Wide shot of a child flying a red kite in a grassy park, golden hour sunlight, camera slowly pans upward.'
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            required
                            disabled={isLoading}
                            className='h-56 min-h-36 resize-none overflow-y-auto rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 [field-sizing:fixed] focus:border-white/50 focus:ring-white/50'
                        />
                        {CAMERA_TEMPLATES.length > 0 && (
                            <div className='flex items-center gap-2 overflow-hidden'>
                                <span className='shrink-0 text-xs text-white/40'>Camera:</span>
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
                                            {template.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {optimizeError && <InlineError>{optimizeError}</InlineError>}
                        <p className='text-xs text-white/40'>
                            Describe: shot type, subject, action, setting, and lighting for best results.
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
                    <ShotBuilderDialog
                        isOpen={isShotBuilderOpen}
                        onOpenChange={setIsShotBuilderOpen}
                        referenceCount={referenceUrls.length}
                        referenceLabels={referenceLabels}
                        onApply={(nextPrompt) => {
                            setPrompt(nextPrompt);
                            setPromptBeforeOptimize(null);
                            setIsShotBuilderOpen(false);
                        }}
                        onBreakdownScript={onBreakdownScript}
                    />

                    <div className='space-y-2'>
                        <Label htmlFor='model-select' className='text-white'>
                            Model
                        </Label>
                        <select
                            id='model-select'
                            value={activeModel}
                            onChange={(event) => {
                                const newModel = event.target.value as VideoModel;
                                setModel((current) => (current === newModel ? current : newModel));
                                // Pull the current choices back into range instead
                                // of submitting something the selected model rejects.
                                if (!modelSupportsResolution(newModel, resolution)) {
                                    setResolution('720p');
                                }
                                setSeconds((prev) => {
                                    const next = clampSeconds(prev, newModel);
                                    return next === prev ? prev : next;
                                });
                                // 1.5 Pro takes a single first-frame image only.
                                setReferenceUrls((prev) => {
                                    const maxImages = maxReferenceImages(newModel);
                                    return prev.length > maxImages ? prev.slice(0, maxImages) : prev;
                                });
                            }}
                            disabled={isLoading}
                            className={nativeSelectClass}>
                            {SEEDANCE_MODELS.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.label} · {m.description}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='ratio-select' className='text-white'>
                                Aspect Ratio
                            </Label>
                            {/* With a reference image the provider derives the ratio
                                from the image and rejects an explicit one. */}
                            <select
                                id='ratio-select'
                                value={ratio}
                                onChange={(event) => setRatio(event.target.value as VideoRatio)}
                                disabled={isLoading || isFirstFrameMode}
                                className={nativeSelectClass}>
                                {RATIOS.map((r) => (
                                    <option key={r} value={r}>
                                        {RATIO_LABELS[r]}
                                    </option>
                                ))}
                            </select>
                            {isFirstFrameMode && <p className='text-xs text-white/40'>Follows the reference image</p>}
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='resolution-select' className='text-white'>
                                Resolution
                            </Label>
                            <select
                                id='resolution-select'
                                value={resolution}
                                onChange={(event) => setResolution(event.target.value as VideoResolution)}
                                disabled={isLoading}
                                className={nativeSelectClass}>
                                {RESOLUTIONS.map((r) => (
                                    <option key={r} value={r} disabled={!modelSupportsResolution(activeModel, r)}>
                                        {r}
                                        {!modelSupportsResolution(activeModel, r) ? ' · not supported' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                            <Label className='text-white'>Duration</Label>
                            <span className='text-sm text-white/60'>{seconds} seconds</span>
                        </div>
                        <Slider
                            value={[seconds]}
                            min={minSeconds}
                            max={maxSeconds}
                            step={1}
                            onValueChange={(value) => setSeconds(value[0] ?? seconds)}
                            disabled={isLoading}
                        />
                        <p className='text-xs text-white/40'>
                            {modelDef?.label ?? 'Seedance'} clips run {minSeconds}–{maxSeconds} seconds.
                        </p>
                    </div>

                    <div className='grid gap-4 sm:grid-cols-2'>
                        <div className='space-y-2'>
                            <Label htmlFor='voice-language-select' className='text-white'>
                                Voice
                            </Label>
                            <select
                                id='voice-language-select'
                                value={normalizedVoiceLanguage}
                                onChange={(event) => setVoiceLanguage(event.target.value)}
                                disabled={isLoading}
                                className={nativeSelectClass}>
                                {VOICE_LANGUAGE_OPTIONS.map((voice) => (
                                    <option key={voice.id} value={voice.id}>
                                        {voice.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className='space-y-2'>
                            <Label className='text-white'>Camera</Label>
                            <div className='flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3'>
                                <Checkbox
                                    id='camera-fixed'
                                    checked={cameraFixed}
                                    onCheckedChange={(checked) => setCameraFixed(checked === true)}
                                    disabled={isLoading || !supportsCameraFixed}
                                    className='border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black'
                                />
                                <Label
                                    htmlFor='camera-fixed'
                                    className={cn(
                                        'cursor-pointer text-white/80',
                                        !supportsCameraFixed && 'cursor-not-allowed text-white/35'
                                    )}>
                                    Fixed camera
                                </Label>
                                {!supportsCameraFixed && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type='button'
                                                className='text-white/35 transition-colors hover:text-white/70'
                                                aria-label='Fixed camera unavailable'>
                                                <HelpCircle className='h-3.5 w-3.5' />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side='top'
                                            className='max-w-64 border border-white/20 bg-black text-white'>
                                            Seedance 2.5 rejects fixed camera, so Studio leaves this setting off for that
                                            model.
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className='rounded-md border border-white/10 bg-white/[0.03]'>
                        <button
                            type='button'
                            onClick={() => setIsAdvancedOpen((open) => !open)}
                            className='flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/5'
                            aria-expanded={isAdvancedOpen}>
                            <span>Advanced</span>
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
                                            Seed
                                        </Label>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type='button'
                                                    className='text-white/45 transition-colors hover:text-white/80'
                                                    aria-label='Seed help'>
                                                    <HelpCircle className='h-3.5 w-3.5' />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent
                                                side='top'
                                                className='max-w-64 border border-white/20 bg-black text-white'>
                                                Use a seed to make similar settings easier to reproduce. Leave it random
                                                unless you want to revisit or fine-tune a previous result.
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <Input
                                        id='seed-input'
                                        type='number'
                                        step={1}
                                        inputMode='numeric'
                                        placeholder='Random'
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
                                    <Checkbox
                                        id='watermark'
                                        checked={watermark}
                                        onCheckedChange={(checked) => setWatermark(checked === true)}
                                        disabled={isLoading}
                                        className='border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black'
                                    />
                                    <div className='flex items-center gap-1.5'>
                                        <Label htmlFor='watermark' className='cursor-pointer text-white/80'>
                                            Watermark
                                        </Label>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type='button'
                                                    className='text-white/45 transition-colors hover:text-white/80'
                                                    aria-label='Watermark help'>
                                                    <HelpCircle className='h-3.5 w-3.5' />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent
                                                side='top'
                                                className='max-w-64 border border-white/20 bg-black text-white'>
                                                Adds a small visible mark in the bottom-right after generation. Use the
                                                field below to customize the text.
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                </div>
                                {watermark && (
                                    <div className='space-y-1'>
                                        <Label htmlFor='watermark-text' className='text-xs text-white/60'>
                                            Watermark text
                                        </Label>
                                        <Input
                                            id='watermark-text'
                                            type='text'
                                            value={watermarkText}
                                            maxLength={100}
                                            onChange={(e) => setWatermarkText(e.target.value.slice(0, 100))}
                                            disabled={isLoading}
                                            placeholder='generated by xcity ai studio'
                                            className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                        />
                                        <div className='text-[10px] text-white/35'>{watermarkText.length}/100</div>
                                    </div>
                                )}
                                <div className='space-y-2'>
                                    <div className='flex items-center gap-1.5'>
                                        <Label htmlFor='caption-mode-select' className='text-white/80'>
                                            Subtitles
                                        </Label>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type='button'
                                                    className='text-white/45 transition-colors hover:text-white/80'
                                                    aria-label='Subtitles help'>
                                                    <HelpCircle className='h-3.5 w-3.5' />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent
                                                side='top'
                                                className='max-w-64 border border-white/20 bg-black text-white'>
                                                Controls subtitle language through the Seedance prompt. Choose None for
                                                no subtitles.
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <select
                                        id='caption-mode-select'
                                        value={normalizedCaptionMode}
                                        onChange={(event) => setCaptionMode(event.target.value)}
                                        disabled={isLoading}
                                        className={nativeSelectClass}>
                                        {CAPTION_MODE_OPTIONS.map((mode) => (
                                            <option key={mode.id} value={mode.id}>
                                                {mode.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {characters.length > 0 && (
                        <div className='space-y-2'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='text-sm text-white'>Characters:</span>
                                <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
                                    {characters.map((character) => {
                                        const isAttached = referenceUrls.includes(character.url);
                                        const disabled = isLoading || (!isAttached && referenceUrls.length >= refCap);
                                        return (
                                            <button
                                                key={character.id}
                                                type='button'
                                                title={
                                                    disabled && !isAttached
                                                        ? `Reference limit reached (${refCap})`
                                                        : `Attach ${character.name}`
                                                }
                                                onClick={() => handleAttachCharacter(character)}
                                                disabled={disabled}
                                                className='inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pr-2 pl-1 text-xs text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                                <span className='h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/5'>
                                                    {/* eslint-disable-next-line @next/next/no-img-element -- worker-hosted URL */}
                                                    <img
                                                        src={character.url}
                                                        alt={character.name}
                                                        loading='lazy'
                                                        className='h-full w-full object-cover'
                                                    />
                                                </span>
                                                <span className='max-w-32 truncate'>{character.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {verifiedPortraits.length > 0 && (
                        <div className='space-y-2'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='text-sm text-white'>Verified people:</span>
                                <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
                                    {verifiedPortraits.map((portrait) => {
                                        const referenceUrl = portraitReferenceUrl(portrait.assetId);
                                        const isAttached = referenceUrls.includes(referenceUrl);
                                        const disabled = isLoading || (!isAttached && referenceUrls.length >= refCap);
                                        return (
                                            <button
                                                key={portrait.assetId}
                                                type='button'
                                                title={
                                                    disabled && !isAttached
                                                        ? `Reference limit reached (${refCap})`
                                                        : `Attach ${portrait.name}`
                                                }
                                                onClick={() => handleAttachPortrait(portrait)}
                                                disabled={disabled}
                                                className='inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.06] py-1 pr-2 pl-1 text-xs text-white/80 transition-colors hover:border-emerald-300/50 hover:bg-emerald-400/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                                <span className='flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-300/30 bg-emerald-300/10'>
                                                    <ShieldCheck className='h-3 w-3 text-emerald-300' />
                                                </span>
                                                <span className='max-w-32 truncate'>{portrait.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {virtualPortraits.length > 0 && (
                        <div className='space-y-2'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='text-sm text-white'>Virtual characters:</span>
                                <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
                                    {virtualPortraits.map((portrait) => {
                                        const referenceUrl = portraitReferenceUrl(portrait.assetId);
                                        const isAttached = referenceUrls.includes(referenceUrl);
                                        const disabled = isLoading || (!isAttached && referenceUrls.length >= refCap);
                                        return (
                                            <button
                                                key={portrait.assetId}
                                                type='button'
                                                title={
                                                    disabled && !isAttached
                                                        ? `Reference limit reached (${refCap})`
                                                        : `Attach ${portrait.name}`
                                                }
                                                onClick={() => handleAttachPortrait(portrait)}
                                                disabled={disabled}
                                                className='inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-300/[0.06] py-1 pr-2 pl-1 text-xs text-white/80 transition-colors hover:border-cyan-200/50 hover:bg-cyan-300/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                                <span className='flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-200/30 bg-cyan-200/10'>
                                                    <Sparkles className='h-3 w-3 text-cyan-200' />
                                                </span>
                                                <span className='max-w-32 truncate'>{portrait.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

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
                        onCreateVirtualAsset={onCreateVirtualAsset}
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
                            onDurationChange={(url, duration) => {
                                setReferenceVideoSecondsByUrl((current) => ({ ...current, [url]: duration }));
                            }}
                            onUpload={onUploadVideo}
                            disabled={isLoading}
                        />
                    )}
                </CardContent>
                <CardFooter className='flex flex-col gap-3 border-t border-white/10 p-4'>
                    <div
                        className='flex w-full rounded-md border border-white/15 bg-white/[0.03] p-1'
                        aria-label='Generation quality'>
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
                                Draft · 480p
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
                            Final · {resolution}
                        </button>
                    </div>
                    <Button
                        type='submit'
                        disabled={isLoading || !prompt.trim() || blockedReferences.length > 0}
                        className='w-full bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                        {isLoading ? (
                            <>
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                Creating Video...
                            </>
                        ) : (
                            <>
                                <Sparkles className='mr-2 h-4 w-4' />
                                Create Video
                            </>
                        )}
                    </Button>
                    {showEstimatedCost && estimatedCost && (
                        <p className='w-full truncate text-xs whitespace-nowrap text-white/60'>
                            Next video estimate: {isCostLowerBound ? 'from ' : ''}$
                            {estimatedCost.totalCost.toFixed(2)} · charged only after success
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
                                            Billing
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardFooter>
            </form>
        </Card>
    );
}
