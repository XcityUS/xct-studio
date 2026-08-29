'use client';

import { ReferenceImagesInput } from '@/components/reference-images-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { calculateVideoCost } from '@/lib/cost-utils';
import type { VideoCharacter, VideoPortrait } from '@/lib/history-merge';
import type { UserAsset } from '@/lib/media-archive';
import { declarationSatisfied, refKey, type ReferenceDeclaration, type ReferenceOrigin } from '@/lib/reference-origin';
import {
    DEFAULT_VIDEO_REFERENCE_MODEL,
    RESOLUTIONS,
    clampSeconds,
    formatSize,
    modelSupportsResolution,
    type VideoResolution
} from '@/lib/seedance';
import type { VideoMetadata } from '@/types/video';
import { Loader2, Rocket } from 'lucide-react';
import * as React from 'react';

export type FinalizeSettings = {
    prompt: string;
    resolution: VideoResolution;
    seconds: number;
    referenceImageUrls: string[];
    generateAudio: boolean;
    watermark: boolean;
    watermarkText?: string;
};

type FinalizeDialogProps = {
    item: VideoMetadata | null;
    open: boolean;
    isSubmitting: boolean;
    defaultWatermarkText: string;
    declarations: Record<string, ReferenceDeclaration>;
    approvedAuthorizationIds: ReadonlySet<string>;
    characters: VideoCharacter[];
    portraits: VideoPortrait[];
    imageAssets: UserAsset[];
    isLoadingImageAssets: boolean;
    onRefreshImageAssets: () => void;
    onCreateVirtualAsset?: (input: { url: string; name: string }) => Promise<string>;
    onDeclareReference: (url: string, origin: ReferenceOrigin) => void;
    onUploadImage?: (file: File) => Promise<string>;
    onOpenAssets?: (referenceKey?: string) => void;
    onOpenChange: (open: boolean) => void;
    onConfirm: (settings: FinalizeSettings) => void;
};

const FINALIZE_MODEL = DEFAULT_VIDEO_REFERENCE_MODEL;
const FINALIZE_RESOLUTIONS = RESOLUTIONS.filter((resolution) => modelSupportsResolution(FINALIZE_MODEL, resolution));
const WATERMARK_LIMIT = 100;

function initialResolution(item: VideoMetadata | null): VideoResolution {
    const candidate = item?.createParams?.resolution ?? item?.finalResolution ?? item?.createParams?.final_resolution;
    if (candidate && RESOLUTIONS.includes(candidate as VideoResolution)) {
        const resolution = candidate as VideoResolution;
        if (modelSupportsResolution(FINALIZE_MODEL, resolution)) return resolution;
    }
    return FINALIZE_RESOLUTIONS[FINALIZE_RESOLUTIONS.length - 1] ?? '720p';
}

function initialPrompt(item: VideoMetadata | null): string {
    return item?.createParams?.prompt ?? item?.prompt ?? '';
}

function initialSeconds(item: VideoMetadata | null): number {
    return clampSeconds(item?.seconds ?? item?.createParams?.seconds ?? 5, FINALIZE_MODEL);
}

function initialReferenceImageUrls(item: VideoMetadata | null): string[] {
    return [...new Set((item?.createParams?.reference_image_urls ?? []).map((url) => url.trim()).filter(Boolean))];
}

export function FinalizeDialog({
    item,
    open,
    isSubmitting,
    defaultWatermarkText,
    declarations,
    approvedAuthorizationIds,
    characters,
    portraits,
    imageAssets,
    isLoadingImageAssets,
    onRefreshImageAssets,
    onCreateVirtualAsset,
    onDeclareReference,
    onUploadImage,
    onOpenAssets,
    onOpenChange,
    onConfirm
}: FinalizeDialogProps) {
    const [prompt, setPrompt] = React.useState(() => initialPrompt(item));
    const [resolution, setResolution] = React.useState<VideoResolution>(() => initialResolution(item));
    const [seconds, setSeconds] = React.useState(() => initialSeconds(item));
    const [referenceImageUrls, setReferenceImageUrls] = React.useState<string[]>(() => initialReferenceImageUrls(item));
    const [generateAudio, setGenerateAudio] = React.useState(true);
    const [watermark, setWatermark] = React.useState(
        () => item?.createParams?.watermark ?? item?.brandingWatermark?.enabled ?? false
    );
    const [watermarkText, setWatermarkText] = React.useState(
        () => item?.createParams?.watermarkText ?? item?.brandingWatermark?.text ?? defaultWatermarkText
    );

    React.useEffect(() => {
        if (!item || !open) return;
        setPrompt(initialPrompt(item));
        setResolution(initialResolution(item));
        setSeconds(initialSeconds(item));
        setReferenceImageUrls(initialReferenceImageUrls(item));
        setGenerateAudio(true);
        setWatermark(item.createParams?.watermark ?? item.brandingWatermark?.enabled ?? false);
        setWatermarkText(item.createParams?.watermarkText ?? item.brandingWatermark?.text ?? defaultWatermarkText);
    }, [defaultWatermarkText, item, open]);

    const costDetails = React.useMemo(() => {
        if (!item) return null;
        return calculateVideoCost({
            model: FINALIZE_MODEL,
            ratio: item.createParams?.ratio ?? '16:9',
            resolution,
            seconds,
            generateAudio,
            inputVideoSeconds: item.seconds
        });
    }, [generateAudio, item, resolution, seconds]);

    const cleanPrompt = prompt.trim();
    const cleanWatermarkText = watermarkText.trim().slice(0, WATERMARK_LIMIT);
    const unresolvedReferenceCount = referenceImageUrls.filter((url) => {
        const key = refKey(url);
        return !key || !declarationSatisfied(declarations[key], approvedAuthorizationIds);
    }).length;
    const canSubmit = Boolean(item && cleanPrompt && unresolvedReferenceCount === 0 && !isSubmitting);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='flex max-h-[88vh] grid-rows-none flex-col gap-0 overflow-hidden border-neutral-700 bg-neutral-950 p-0 text-white sm:max-w-[560px]'>
                <DialogHeader>
                    <DialogTitle className='px-6 pt-6 text-white'>Finalize Draft</DialogTitle>
                    <DialogDescription className='px-6 text-neutral-400'>
                        Create a new Seedance 2.5 final version from this draft video. This starts a new paid
                        generation.
                    </DialogDescription>
                </DialogHeader>

                <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4'>
                    <div className='rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100'>
                        Uses the draft as a reference video, not a simple upscale. Motion and details can change.
                    </div>

                    <div className='grid gap-2'>
                        <Label htmlFor='finalize-prompt' className='text-white/80'>
                            Prompt
                        </Label>
                        <Textarea
                            id='finalize-prompt'
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            className='h-40 max-h-40 min-h-40 resize-none overflow-y-auto border-white/15 bg-white/[0.03] text-white placeholder:text-white/30'
                        />
                    </div>

                    <ReferenceImagesInput
                        urls={referenceImageUrls}
                        onChange={setReferenceImageUrls}
                        maxImages={30}
                        onUpload={onUploadImage}
                        declarations={declarations}
                        onDeclare={onDeclareReference}
                        approvedAuthorizationIds={approvedAuthorizationIds}
                        onOpenAssets={onOpenAssets}
                        characters={characters}
                        portraits={portraits}
                        showAssetLibrary
                        imageAssets={imageAssets}
                        isLoadingImageAssets={isLoadingImageAssets}
                        onRefreshImageAssets={onRefreshImageAssets}
                        onCreateVirtualAsset={onCreateVirtualAsset}
                        label='Edit reference images (optional)'
                        hint='Use these as visual references for editing the draft video. Cite [Image 1], [Image 2] in the prompt.'
                        disabled={isSubmitting}
                    />
                    {unresolvedReferenceCount > 0 && (
                        <div className='rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100'>
                            Choose the source for each reference image before generating.
                        </div>
                    )}

                    <div className='grid gap-2'>
                        <Label className='text-white/80'>Output specs</Label>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='inline-flex h-9 items-center rounded-md border border-white/15 bg-white/[0.03] px-3 text-sm text-white'>
                                {formatSize(item?.createParams?.ratio ?? '16:9', resolution)}
                            </span>
                            <span className='inline-flex h-9 items-center rounded-md border border-white/15 bg-white/[0.03] px-3 text-sm text-white'>
                                {resolution}
                            </span>
                            <span className='inline-flex h-9 items-center rounded-md border border-white/15 bg-white/[0.03] px-3 text-sm text-white'>
                                {seconds}s
                            </span>
                        </div>
                        <div className='text-sm text-white/45'>
                            Video editing follows the source draft size and duration.
                        </div>
                    </div>

                    <div className='grid gap-2'>
                        <label className='flex items-center gap-2 text-sm text-white/75'>
                            <input
                                type='checkbox'
                                checked={generateAudio}
                                disabled={isSubmitting}
                                onChange={(event) => setGenerateAudio(event.target.checked)}
                                className='h-4 w-4 accent-white'
                            />
                            Generate synchronized audio
                        </label>
                        <label className='flex items-center gap-2 text-sm text-white/75'>
                            <input
                                type='checkbox'
                                checked={watermark}
                                disabled={isSubmitting}
                                onChange={(event) => setWatermark(event.target.checked)}
                                className='h-4 w-4 accent-white'
                            />
                            Add Studio watermark
                        </label>
                        {watermark && (
                            <input
                                value={watermarkText}
                                maxLength={WATERMARK_LIMIT}
                                disabled={isSubmitting}
                                onChange={(event) => setWatermarkText(event.target.value.slice(0, WATERMARK_LIMIT))}
                                className='h-9 rounded-md border border-white/15 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-white/35'
                            />
                        )}
                    </div>

                    <div className='rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70'>
                        <div className='flex justify-between gap-3'>
                            <span>Model</span>
                            <span className='text-right text-white'>Seedance 2.5</span>
                        </div>
                        <div className='mt-1 flex justify-between gap-3'>
                            <span>Output</span>
                            <span className='text-right text-white'>
                                {formatSize(item?.createParams?.ratio ?? '16:9', resolution)} · {seconds}s
                            </span>
                        </div>
                        <div className='mt-1 flex justify-between gap-3'>
                            <span>Estimated charge</span>
                            <span className='text-right text-white'>
                                {costDetails
                                    ? `${costDetails.lowerBound ? 'from ' : ''}$${costDetails.totalCost.toFixed(2)}`
                                    : '-'}
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter className='border-t border-white/10 bg-neutral-950 px-6 py-4'>
                    <Button
                        type='button'
                        variant='outline'
                        disabled={isSubmitting}
                        onClick={() => onOpenChange(false)}
                        className='border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                        Cancel
                    </Button>
                    <Button
                        type='button'
                        disabled={!canSubmit}
                        onClick={() =>
                            onConfirm({
                                prompt: cleanPrompt,
                                resolution,
                                seconds,
                                referenceImageUrls,
                                generateAudio,
                                watermark,
                                watermarkText: watermark ? cleanWatermarkText || defaultWatermarkText : undefined
                            })
                        }
                        className='bg-white text-black hover:bg-white/90'>
                        {isSubmitting ? (
                            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        ) : (
                            <Rocket className='mr-2 h-4 w-4' />
                        )}
                        Generate final
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
