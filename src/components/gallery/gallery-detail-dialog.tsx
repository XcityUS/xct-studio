'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { calculateVideoCost } from '@/lib/cost-utils';
import { formatDuration, galleryMediaUrl, type GalleryItem } from '@/lib/gallery';
import { getSeedanceModel } from '@/lib/seedance';
import { Check, Copy, ImageIcon, RefreshCw } from 'lucide-react';
import * as React from 'react';

/**
 * Detail view: player on the left, everything the grid deliberately omitted on
 * the right. The cost line is the thing competitors don't show and the reason
 * this gallery is useful to someone deciding what to spend — keep it.
 */
export function GalleryDetailDialog({
    item,
    workerUrl,
    onClose,
    onUsePreset,
    onUseAsReference
}: {
    item: GalleryItem | null;
    workerUrl: string;
    onClose: () => void;
    onUsePreset: (item: GalleryItem) => void;
    onUseAsReference: (item: GalleryItem) => void;
}) {
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => setCopied(false), [item?.slug]);

    if (!item) return null;

    const model = getSeedanceModel(item.params.model);
    const cost = calculateVideoCost({
        model: item.params.model,
        resolution: item.params.resolution,
        seconds: item.params.seconds
    });

    const copyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(item.params.prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard can be blocked; the prompt is selectable either way.
        }
    };

    const chips = [
        model?.label ?? item.params.model,
        item.params.ratio,
        item.params.resolution,
        formatDuration(item.params.seconds),
        item.params.generate_audio ? 'Audio' : 'Silent'
    ];

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className='max-h-[90vh] gap-0 overflow-y-auto border-white/15 bg-black p-0 sm:max-w-5xl'>
                <div className='grid gap-0 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'>
                    <div className='flex items-center justify-center bg-black p-2'>
                        <video
                            key={item.slug}
                            src={galleryMediaUrl(workerUrl, item.media.video)}
                            poster={galleryMediaUrl(workerUrl, item.media.poster)}
                            controls
                            autoPlay
                            loop
                            playsInline
                            preload='metadata'
                            className='max-h-[70vh] w-full rounded-md'
                        />
                    </div>

                    <div className='space-y-4 border-t border-white/10 p-5 md:border-l md:border-t-0'>
                        <div>
                            <DialogTitle className='text-lg font-medium text-white'>{item.title}</DialogTitle>
                            <DialogDescription className='mt-1 text-xs text-white/40'>
                                Generated with Xcity Video Studio · AI-generated content
                            </DialogDescription>
                        </div>

                        <div className='flex flex-wrap gap-1.5'>
                            {chips.map((chip) => (
                                <span
                                    key={chip}
                                    className='rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/70'>
                                    {chip}
                                </span>
                            ))}
                            {cost && (
                                <span
                                    className='rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300'
                                    title='What this clip cost to generate'>
                                    ${cost.totalCost.toFixed(2)}
                                </span>
                            )}
                        </div>

                        <div className='space-y-1.5'>
                            <div className='flex items-center justify-between'>
                                <h4 className='text-xs font-semibold uppercase tracking-wider text-white/50'>Prompt</h4>
                                <button
                                    type='button'
                                    onClick={copyPrompt}
                                    className='flex items-center gap-1 text-xs text-white/50 transition-colors hover:text-white'>
                                    {copied ? <Check className='h-3 w-3 text-emerald-400' /> : <Copy className='h-3 w-3' />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <p className='whitespace-pre-wrap rounded-md bg-white/5 p-3 text-sm leading-relaxed text-white/80'>
                                {item.params.prompt}
                            </p>
                        </div>

                        {item.note && (
                            <p className='border-l-2 border-white/20 pl-3 text-xs italic text-white/50'>{item.note}</p>
                        )}

                        <div className='flex flex-col gap-2 pt-1'>
                            <Button
                                onClick={() => onUsePreset(item)}
                                className='w-full bg-white text-black hover:bg-white/90'>
                                <RefreshCw className='mr-2 h-4 w-4' />
                                Use these settings
                            </Button>
                            <Button
                                variant='secondary'
                                onClick={() => onUseAsReference(item)}
                                className='w-full bg-white/10 text-white hover:bg-white/20'>
                                <ImageIcon className='mr-2 h-4 w-4' />
                                Use frame as reference
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
