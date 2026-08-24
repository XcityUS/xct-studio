'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { db, type ImageRecord } from '@/lib/db';
import {
    IMAGE_SIZES,
    type GeneratedImage,
    type ImageModel,
    type ImageSizeId
} from '@/lib/image-service';
import { cn } from '@/lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clapperboard, Download, ImageIcon, Loader2, Sparkles, Trash2 } from 'lucide-react';
import * as React from 'react';

interface ImageStudioProps {
    /** Runtime-resolved image models. Empty means image generation is disabled. */
    imageModels: ImageModel[];
    /** Runs the generation on the user's key; the studio stores the results. */
    onGenerate: (params: { prompt: string; model: string; size: ImageSizeId; n: number }) => Promise<GeneratedImage[]>;
    /**
     * 发送到图生视频 — resolves a public URL for the image and moves it into
     * the video form. Absent when no media worker is configured and the
     * record has no usable remote URL.
     */
    onAnimate?: (record: ImageRecord) => Promise<void>;
}

/** Object URLs for stored blobs, created in an effect and revoked on cleanup. */
function useImageObjectUrls(records: ImageRecord[] | undefined) {
    const urlsRef = React.useRef<Map<string, string>>(new Map());
    const [, setVersion] = React.useState(0);

    React.useEffect(() => {
        if (!records) return;
        const urls = urlsRef.current;
        const liveIds = new Set(records.map((r) => r.id));
        let changed = false;

        for (const [id, url] of urls) {
            if (!liveIds.has(id)) {
                URL.revokeObjectURL(url);
                urls.delete(id);
                changed = true;
            }
        }
        for (const rec of records) {
            if (rec.blob && !urls.has(rec.id)) {
                urls.set(rec.id, URL.createObjectURL(rec.blob));
                changed = true;
            }
        }
        if (changed) setVersion((v) => v + 1);
    }, [records]);

    React.useEffect(() => {
        const urls = urlsRef.current;
        return () => {
            for (const [, url] of urls) URL.revokeObjectURL(url);
            urls.clear();
        };
    }, []);

    return React.useCallback((rec: ImageRecord): string | undefined => {
        return urlsRef.current.get(rec.id) ?? rec.source_url;
    }, []);
}

export function ImageStudio({ imageModels, onGenerate, onAnimate }: ImageStudioProps) {
    const [prompt, setPrompt] = React.useState('');
    const [model, setModel] = React.useState('');
    const [size, setSize] = React.useState<ImageSizeId>('1024x1024');
    const [count, setCount] = React.useState(1);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [animatingId, setAnimatingId] = React.useState<string | null>(null);

    const records = useLiveQuery<ImageRecord[] | undefined>(
        () => db.images.orderBy('created_at').reverse().toArray(),
        []
    );
    const getSrc = useImageObjectUrls(records);

    React.useEffect(() => {
        if (model || imageModels.length === 0) return;
        setModel(imageModels[0].id);
    }, [imageModels, model]);

    const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt || isGenerating) return;
        if (!model) {
            setError('Image generation is not configured.');
            return;
        }
        setIsGenerating(true);
        setError(null);
        try {
            const images = await onGenerate({ prompt: trimmedPrompt, model, size, n: count });
            const now = Date.now();
            await db.images.bulkPut(
                images.map((img, i) => ({
                    id: `img_${now}_${i}`,
                    prompt: trimmedPrompt,
                    model,
                    size,
                    blob: img.blob,
                    source_url: img.url,
                    created_at: now
                }))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Image generation failed.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = (rec: ImageRecord) => {
        const src = getSrc(rec);
        if (!src) return;
        const a = document.createElement('a');
        a.href = src;
        a.download = `${rec.id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleAnimate = async (rec: ImageRecord) => {
        if (!onAnimate || animatingId) return;
        setAnimatingId(rec.id);
        setError(null);
        try {
            await onAnimate(rec);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send the image to video.');
        } finally {
            setAnimatingId(null);
        }
    };

    return (
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start'>
            <Card className='flex w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
                <CardHeader className='border-b border-white/10 pb-4'>
                    <CardTitle className='text-lg font-medium text-white'>Create Image</CardTitle>
                    <CardDescription className='mt-1 text-white/60'>
                        Generate images, then animate them into videos.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleGenerate}>
                    <CardContent className='space-y-5 p-4'>
                        <div className='space-y-1.5'>
                            <Label htmlFor='image-prompt' className='text-white'>
                                Prompt
                            </Label>
                            <Textarea
                                id='image-prompt'
                                placeholder='e.g., A watercolor painting of a fox in a misty autumn forest, soft morning light.'
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                required
                                disabled={isGenerating}
                                className='min-h-[100px] resize-none rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                            />
                        </div>

                        <div className='grid grid-cols-2 gap-4'>
                            <div className='space-y-2'>
                                <Label htmlFor='image-model' className='text-white'>
                                    Model
                                </Label>
                                <Select
                                    value={model}
                                    onValueChange={setModel}
                                    disabled={isGenerating || imageModels.length === 0}>
                                    <SelectTrigger
                                        id='image-model'
                                        className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                        <SelectValue placeholder='No models' />
                                    </SelectTrigger>
                                    <SelectContent className='border-white/20 bg-black text-white'>
                                        {imageModels.map((m) => (
                                            <SelectItem key={m.id} value={m.id} className='focus:bg-white/10 focus:text-white'>
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className='space-y-2'>
                                <Label htmlFor='image-size' className='text-white'>
                                    Size
                                </Label>
                                <Select
                                    value={size}
                                    onValueChange={(v) => setSize(v as ImageSizeId)}
                                    disabled={isGenerating}>
                                    <SelectTrigger
                                        id='image-size'
                                        className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className='border-white/20 bg-black text-white'>
                                        {IMAGE_SIZES.map((s) => (
                                            <SelectItem key={s.id} value={s.id} className='focus:bg-white/10 focus:text-white'>
                                                {s.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className='space-y-2'>
                            <Label className='text-white'>Count</Label>
                            <div className='flex gap-2'>
                                {[1, 2, 3, 4].map((n) => (
                                    <button
                                        key={n}
                                        type='button'
                                        onClick={() => setCount(n)}
                                        disabled={isGenerating}
                                        className={cn(
                                            'h-8 w-8 rounded-md text-sm transition-colors',
                                            count === n
                                                ? 'bg-white text-black'
                                                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                                        )}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && <p className='text-sm text-red-400'>{error}</p>}

                        <Button
                            type='submit'
                            disabled={isGenerating || !prompt.trim() || !model}
                            className='w-full bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                            {isGenerating ? (
                                <>
                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    Generating…
                                </>
                            ) : (
                                <>
                                    <Sparkles className='mr-2 h-4 w-4' />
                                    Generate
                                </>
                            )}
                        </Button>
                    </CardContent>
                </form>
            </Card>

            <Card className='flex min-h-[400px] w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
                <CardHeader className='border-b border-white/10 pb-4'>
                    <CardTitle className='text-lg font-medium text-white'>Images</CardTitle>
                    <CardDescription className='mt-1 text-white/60'>
                        Stored in your browser. Animate sends one to the video form.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex-1 p-4'>
                    {!records || records.length === 0 ? (
                        <div className='flex h-full min-h-[280px] flex-col items-center justify-center text-white/40'>
                            <ImageIcon className='mb-3 h-10 w-10 text-white/20' />
                            <p>Generated images will appear here.</p>
                        </div>
                    ) : (
                        <div className='grid grid-cols-2 gap-4'>
                            {records.map((rec) => {
                                const src = getSrc(rec);
                                return (
                                    <div key={rec.id} className='flex flex-col'>
                                        <div className='relative aspect-square overflow-hidden rounded-t-md border border-white/20 bg-neutral-900'>
                                            {src ? (
                                                // eslint-disable-next-line @next/next/no-img-element -- blob/worker URL, not a static asset
                                                <img src={src} alt={rec.prompt} className='h-full w-full object-cover' />
                                            ) : (
                                                <div className='flex h-full items-center justify-center text-white/30'>
                                                    expired
                                                </div>
                                            )}
                                            <button
                                                type='button'
                                                onClick={() => void db.images.delete(rec.id)}
                                                className='absolute top-1 right-1 rounded-full bg-red-600/80 p-1 text-white transition-colors hover:bg-red-500/90'
                                                aria-label='Delete image'>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <div className='rounded-b-md border border-t-0 border-white/20 bg-neutral-900/50 p-2'>
                                            <p className='line-clamp-1 text-xs text-white/70' title={rec.prompt}>
                                                {rec.prompt}
                                            </p>
                                            <div className='mt-1.5 flex items-center gap-1'>
                                                <button
                                                    type='button'
                                                    onClick={() => handleDownload(rec)}
                                                    className='flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                    <Download size={11} />
                                                    Save
                                                </button>
                                                {onAnimate && (
                                                    <button
                                                        type='button'
                                                        onClick={() => void handleAnimate(rec)}
                                                        disabled={animatingId !== null}
                                                        title='Use as the first frame of a video'
                                                        className='flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-40'>
                                                        {animatingId === rec.id ? (
                                                            <Loader2 size={11} className='animate-spin' />
                                                        ) : (
                                                            <Clapperboard size={11} />
                                                        )}
                                                        Animate
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
