'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ReferenceImageInput } from '@/components/reference-image-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { calculateVideoCost } from '@/lib/cost-utils';
import {
    RATIOS,
    RESOLUTIONS,
    SEEDANCE_MODELS,
    clampSeconds,
    getSeedanceModel,
    modelSupportsResolution,
    secondsRange,
    type VideoModel,
    type VideoRatio,
    type VideoResolution
} from '@/lib/seedance';
import { PromptInspirationDialog } from '@/components/prompt-inspiration';
import { applyPromptTemplate } from '@/lib/prompt-templates';
import type { VideoJobCreate } from '@/types/video';
import { Lightbulb, Loader2, Sparkles, Undo2, Wand2 } from 'lucide-react';
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
    inputReferenceUrl: string;
    setInputReferenceUrl: React.Dispatch<React.SetStateAction<string>>;
    /** Uploads a local image, resolving to its public URL. Absent = URL-only mode. */
    onUploadImage?: (file: File) => Promise<string>;
    /** Rewrites the prompt via the gateway's chat API. Absent = button hidden. */
    onOptimizePrompt?: (prompt: string) => Promise<string>;
};

const RATIO_LABELS: Record<VideoRatio, string> = {
    '16:9': '16:9 · Landscape',
    '9:16': '9:16 · Portrait',
    '1:1': '1:1 · Square',
    '4:3': '4:3 · Classic',
    '21:9': '21:9 · Cinematic'
};

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
    inputReferenceUrl,
    setInputReferenceUrl,
    onUploadImage,
    onOptimizePrompt
}: CreationFormProps) {
    const { min: minSeconds, max: maxSeconds } = secondsRange(model);
    const modelDef = getSeedanceModel(model);
    const estimatedCost = calculateVideoCost({ model, resolution, seconds });

    const [isInspirationOpen, setIsInspirationOpen] = React.useState(false);
    const [isOptimizing, setIsOptimizing] = React.useState(false);
    const [optimizeError, setOptimizeError] = React.useState<string | null>(null);
    // The prompt as it was before the last AI rewrite, so Undo can restore it.
    const [promptBeforeOptimize, setPromptBeforeOptimize] = React.useState<string | null>(null);

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

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData: CreationFormData = {
            model,
            prompt,
            ratio,
            resolution,
            seconds,
            generate_audio: generateAudio,
            camera_fixed: cameraFixed
        };
        const referenceUrl = inputReferenceUrl.trim();
        if (referenceUrl) {
            formData.input_reference_url = referenceUrl;
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
                        <div className='flex items-center justify-between'>
                            <Label htmlFor='prompt' className='text-white'>
                                Prompt
                            </Label>
                            <div className='flex items-center gap-1'>
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

                    <div className='space-y-2'>
                        <Label htmlFor='model-select' className='text-white'>
                            Model
                        </Label>
                        <Select
                            value={model}
                            onValueChange={(value) => {
                                const newModel = value as VideoModel;
                                setModel(newModel);
                                // Capabilities differ per model: 2.0 Fast has no
                                // 1080p, only 2.5 does 4K, and only 2.5 goes past
                                // 12s. Pull the current choices back into range
                                // instead of submitting something the model rejects.
                                if (!modelSupportsResolution(newModel, resolution)) {
                                    setResolution('720p');
                                }
                                setSeconds((prev) => clampSeconds(prev, newModel));
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
                            <Select value={ratio} onValueChange={(value) => setRatio(value as VideoRatio)} disabled={isLoading}>
                                <SelectTrigger
                                    id='ratio-select'
                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
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

                    <ReferenceImageInput
                        value={inputReferenceUrl}
                        onChange={setInputReferenceUrl}
                        onUpload={onUploadImage}
                        disabled={isLoading}
                        label='Reference Image (Optional)'
                        hint='Image-to-video: the clip starts from this frame, guided by your prompt.'
                    />
                </CardContent>
                <CardFooter className='flex items-center gap-3 border-t border-white/10 p-4'>
                    <Button
                        type='submit'
                        disabled={isLoading || !prompt.trim()}
                        className='flex-1 bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
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
                        <span
                            className='whitespace-nowrap text-sm text-white/60'
                            title={modelDef?.priceIsEstimate ? 'Provisional rate — BytePlus has not published pricing for this model yet' : undefined}>
                            ≈ ${estimatedCost.totalCost.toFixed(2)}
                            {modelDef?.priceIsEstimate && <span className='ml-1 text-white/40'>est.</span>}
                        </span>
                    )}
                </CardFooter>
            </form>
        </Card>
    );
}
