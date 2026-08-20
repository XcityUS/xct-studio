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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import type { VideoCharacter, VideoPortrait } from '@/hooks/use-video-history';
import { calculateVideoCost } from '@/lib/cost-utils';
import { PROMPT_TEMPLATE_CATEGORIES, applyPromptTemplate } from '@/lib/prompt-templates';
import {
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
import { ChevronDown, Clapperboard, Lightbulb, Loader2, ShieldCheck, Sparkles, Undo2, Wand2 } from 'lucide-react';
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
    generateAudio: boolean;
    setGenerateAudio: React.Dispatch<React.SetStateAction<boolean>>;
    cameraFixed: boolean;
    setCameraFixed: React.Dispatch<React.SetStateAction<boolean>>;
    referenceUrls: string[];
    setReferenceUrls: React.Dispatch<React.SetStateAction<string[]>>;
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
    /** Uploads a local image, resolving to its public URL. Absent = URL-only mode. */
    onUploadImage?: (file: File) => Promise<string>;
    /** Uploads a local audio file, resolving to its public URL. Absent = URL-only mode. */
    onUploadAudio?: (file: File) => Promise<string>;
    /** Generates speech, uploads it, and resolves to its public URL. */
    onSynthesizeSpeech?: (text: string, voice: TtsVoice) => Promise<string>;
    /** Uploads a local video file, resolving to its public URL. Absent = URL-only mode. */
    onUploadVideo?: (file: File) => Promise<string>;
    /** Rewrites the prompt via the gateway's chat API. Absent = button hidden. */
    onOptimizePrompt?: (prompt: string) => Promise<string>;
    /** Splits a script into Seedance shot rows via the gateway's chat API. */
    onBreakdownScript?: (script: string) => Promise<ShotDraft[]>;
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
    generateAudio,
    setGenerateAudio,
    cameraFixed,
    setCameraFixed,
    referenceUrls,
    setReferenceUrls,
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
    onUploadImage,
    onUploadAudio,
    onSynthesizeSpeech,
    onUploadVideo,
    onOptimizePrompt,
    onBreakdownScript
}: CreationFormProps) {
    const { min: minSeconds, max: maxSeconds } = secondsRange(model);
    const modelDef = getSeedanceModel(model);
    const refCap = maxReferenceImages(model);
    // Ratio is provider-derived only in first-frame mode (exactly one image).
    const isFirstFrameMode = referenceUrls.length === 1;
    const showMultiReferenceMedia = refCap > 1 && referenceUrls.length >= 2;
    const showReferenceAudio = showMultiReferenceMedia;
    const showReferenceVideos = showMultiReferenceMedia;

    const [isInspirationOpen, setIsInspirationOpen] = React.useState(false);
    const [isShotBuilderOpen, setIsShotBuilderOpen] = React.useState(false);
    const [isOptimizing, setIsOptimizing] = React.useState(false);
    const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);
    const [optimizeError, setOptimizeError] = React.useState<string | null>(null);
    // The prompt as it was before the last AI rewrite, so Undo can restore it.
    const [promptBeforeOptimize, setPromptBeforeOptimize] = React.useState<string | null>(null);
    const [referenceVideoSecondsByUrl, setReferenceVideoSecondsByUrl] = React.useState<Record<string, number>>({});
    const supportsDraftMode = modelSupportsResolution(model, '480p');
    const [generationMode, setGenerationMode] = React.useState<GenerationMode>(() =>
        modelSupportsResolution(model, '480p') ? 'draft' : 'final'
    );
    const referenceLabels = React.useMemo(() => {
        const labelsByUrl = new Map<string, string>([
            ...characters.map((character) => [character.url, character.name] as const),
            ...portraits.map((portrait) => [portraitReferenceUrl(portrait.assetId), portrait.name] as const)
        ]);
        return referenceUrls.map((url) => labelsByUrl.get(url) ?? null);
    }, [characters, portraits, referenceUrls]);

    React.useEffect(() => {
        if (!supportsDraftMode) {
            setGenerationMode('final');
        }
    }, [supportsDraftMode]);

    const isDraftMode = supportsDraftMode && generationMode === 'draft';
    const activeResolution: VideoResolution = isDraftMode ? '480p' : resolution;
    const hasReferenceVideos = showReferenceVideos && referenceVideoUrls.some((url) => url.trim());
    const inputVideoSeconds = React.useMemo(() => {
        if (!hasReferenceVideos) return 0;
        return referenceVideoUrls.reduce((total, url) => total + (referenceVideoSecondsByUrl[url] ?? 0), 0);
    }, [hasReferenceVideos, referenceVideoSecondsByUrl, referenceVideoUrls]);
    const estimatedCost = calculateVideoCost({
        model,
        ratio,
        resolution: activeResolution,
        seconds,
        generateAudio,
        inputVideoSeconds
    });
    const isCostLowerBound = Boolean(estimatedCost && (estimatedCost.lowerBound || hasReferenceVideos));

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
        const formData: CreationFormData = {
            model,
            prompt,
            ratio,
            resolution: activeResolution,
            seconds,
            generate_audio: generateAudio,
            camera_fixed: cameraFixed,
            seed,
            watermark
        };
        if (isDraftMode) {
            formData.draft = true;
            formData.final_resolution = resolution;
        }
        const refs = referenceUrls.map((u) => u.trim()).filter(Boolean);
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
            const videos = referenceVideoUrls.map((u) => u.trim()).filter(Boolean);
            if (showReferenceVideos && videos.length) {
                formData.reference_video_urls = videos.slice(0, 2);
                formData.reference_video_seconds = formData.reference_video_urls.map(
                    (url) => referenceVideoSecondsByUrl[url] ?? 0
                );
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
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4 lg:overflow-visible'>
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
                            className='min-h-[100px] resize-none rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
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
                        {optimizeError && <p className='text-xs text-red-400'>{optimizeError}</p>}
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
                        <Select
                            value={model}
                            onValueChange={(value) => {
                                const newModel = value as VideoModel;
                                setModel(newModel);
                                // Pull the current choices back into range instead
                                // of submitting something the selected model rejects.
                                if (!modelSupportsResolution(newModel, resolution)) {
                                    setResolution('720p');
                                }
                                setSeconds((prev) => clampSeconds(prev, newModel));
                                // 1.5 Pro takes a single first-frame image only.
                                setReferenceUrls((prev) => prev.slice(0, maxReferenceImages(newModel)));
                            }}
                            disabled={isLoading}>
                            <SelectTrigger
                                id='model-select'
                                className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className='border-white/20 bg-black text-white'>
                                {SEEDANCE_MODELS.map((m) => (
                                    <SelectItem key={m.id} value={m.id} className='focus:bg-white/10 focus:text-white'>
                                        {m.label}
                                        <span className='ml-2 text-xs text-white/40'>{m.description}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='ratio-select' className='text-white'>
                                Aspect Ratio
                            </Label>
                            {/* With a reference image the provider derives the ratio
                                from the image and rejects an explicit one. */}
                            <Select
                                value={ratio}
                                onValueChange={(value) => setRatio(value as VideoRatio)}
                                disabled={isLoading || isFirstFrameMode}>
                                <SelectTrigger
                                    id='ratio-select'
                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50 disabled:opacity-50'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className='border-white/20 bg-black text-white'>
                                    {RATIOS.map((r) => (
                                        <SelectItem key={r} value={r} className='focus:bg-white/10 focus:text-white'>
                                            {RATIO_LABELS[r]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {isFirstFrameMode && <p className='text-xs text-white/40'>Follows the reference image</p>}
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='resolution-select' className='text-white'>
                                Resolution
                            </Label>
                            <Select
                                value={resolution}
                                onValueChange={(value) => setResolution(value as VideoResolution)}
                                disabled={isLoading}>
                                <SelectTrigger
                                    id='resolution-select'
                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className='border-white/20 bg-black text-white'>
                                    {RESOLUTIONS.map((r) => (
                                        <SelectItem
                                            key={r}
                                            value={r}
                                            disabled={!modelSupportsResolution(model, r)}
                                            className='focus:bg-white/10 focus:text-white disabled:cursor-not-allowed disabled:opacity-50'>
                                            {r}
                                            {!modelSupportsResolution(model, r) && (
                                                <span className='ml-2 text-xs text-white/40'>not supported</span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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

                    <div className='flex flex-wrap items-center gap-x-6 gap-y-2'>
                        <div className='flex items-center space-x-2'>
                            <Checkbox
                                id='generate-audio'
                                checked={generateAudio}
                                onCheckedChange={(checked) => setGenerateAudio(checked === true)}
                                disabled={isLoading}
                                className='border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black'
                            />
                            <Label htmlFor='generate-audio' className='cursor-pointer text-white/80'>
                                Generate synchronized audio
                            </Label>
                        </div>
                        <div className='flex items-center space-x-2'>
                            <Checkbox
                                id='camera-fixed'
                                checked={cameraFixed}
                                onCheckedChange={(checked) => setCameraFixed(checked === true)}
                                disabled={isLoading}
                                className='border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black'
                            />
                            <Label htmlFor='camera-fixed' className='cursor-pointer text-white/80'>
                                Fixed camera
                            </Label>
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
                                    <Label htmlFor='seed-input' className='text-white/80'>
                                        Seed
                                    </Label>
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
                                    <Label htmlFor='watermark' className='cursor-pointer text-white/80'>
                                        Watermark
                                    </Label>
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

                    {portraits.length > 0 && (
                        <div className='space-y-2'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='text-sm text-white'>Verified people:</span>
                                <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
                                    {portraits.map((portrait) => {
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

                    <ReferenceImagesInput
                        urls={referenceUrls}
                        onChange={setReferenceUrls}
                        maxImages={refCap}
                        lastFrameUrl={lastFrameUrl}
                        onLastFrameChange={setLastFrameUrl}
                        onUpload={onUploadImage}
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
                        disabled={isLoading || !prompt.trim()}
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
                    {estimatedCost && (
                        <p className='w-full truncate text-xs whitespace-nowrap text-white/60'>
                            Est. {isCostLowerBound ? 'from ' : ''}${estimatedCost.totalCost.toFixed(2)} · charged on
                            success
                        </p>
                    )}
                </CardFooter>
            </form>
        </Card>
    );
}
