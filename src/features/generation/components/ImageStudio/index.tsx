'use client';

import { persistImages, removeImage } from '@/features/persistence/media';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { db, type ImageRecord } from '@/features/assets/storage/db';
import {
    IMAGE_SIZES,
    type GeneratedImage,
    type ImageModel,
    type ImageSizeId
} from '@/lib/image-service';
import type { UserAsset } from '@/lib/media-archive';
import { cn } from '@/shared/utils/classnames';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clapperboard, Download, Expand, ImageIcon, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const SCROLLBAR_GUTTER_WIDTH = 2;
const CARD_GAP = 16;
const CARD_FOOTER_HEIGHT = 72;

interface ImageStudioProps {
    /** Runtime-resolved image models. Empty means image generation is disabled. */
    imageModels: ImageModel[];
    /** Runs the generation on the user's key; the studio stores the results. */
    onGenerate: (params: { prompt: string; model: string; size: ImageSizeId; n: number }) => Promise<GeneratedImage[]>;
    /** Cloud images stored by the media worker, shared with the Assets module. */
    cloudImageAssets?: UserAsset[];
    /**
     * 发送到图生视频 — resolves a public URL for the image and moves it into
     * the video form. Absent when no media worker is configured and the
     * record has no usable remote URL.
     */
    onAnimate?: (record: ImageRecord) => Promise<void>;
}

function imageRecordFromAsset(asset: UserAsset): ImageRecord {
    return {
        id: `asset:${asset.key}`,
        prompt: asset.name ?? asset.key,
        model: 'Cloud asset',
        size: 'cloud',
        source_url: asset.url,
        created_at: asset.uploaded ? Date.parse(asset.uploaded) || 0 : 0
    };
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

export function ImageStudio({ imageModels, onGenerate, cloudImageAssets = [], onAnimate }: ImageStudioProps) {
    const t = useTranslations();
    const [prompt, setPrompt] = React.useState('');
    const [model, setModel] = React.useState('');
    const [size, setSize] = React.useState<ImageSizeId>('1024x1024');
    const [count, setCount] = React.useState(1);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [lastBatchSummary, setLastBatchSummary] = React.useState<string | null>(null);
    const [animatingId, setAnimatingId] = React.useState<string | null>(null);
    const [pendingGenerationCount, setPendingGenerationCount] = React.useState(0);
    const [previewImage, setPreviewImage] = React.useState<{ src: string; prompt: string } | null>(
        null
    );

    const listContainerRef = React.useRef<HTMLDivElement>(null);
    const [listWidth, setListWidth] = React.useState(0);
    const [containerHeight, setContainerHeight] = React.useState(0);
    const [scrollTop, setScrollTop] = React.useState(0);
    const [columns, setColumns] = React.useState(2);

    const records = useLiveQuery<ImageRecord[] | undefined>(
        () => db.images.orderBy('created_at').reverse().toArray(),
        []
    );
    const getSrc = useImageObjectUrls(records);
    const visibleRecords = React.useMemo(() => {
        const localRecords = records ?? [];
        const localUrls = new Set(localRecords.map((rec) => rec.source_url).filter(Boolean));
        const cloudRecords = cloudImageAssets
            .filter((asset) => asset.kind === 'image' && asset.url && !localUrls.has(asset.url))
            .map(imageRecordFromAsset);
        return [...localRecords, ...cloudRecords];
    }, [cloudImageAssets, records]);

    const allItems = React.useMemo(() => {
        const pendingItems = Array.from({ length: pendingGenerationCount }).map((_, index) => ({
            kind: 'pending' as const,
            id: `pending-image-${index}`,
            prompt: t('Generating')
        }));
        const recordsItems = visibleRecords.map((record) => ({ kind: 'record' as const, record }));
        return [...pendingItems, ...recordsItems];
    }, [pendingGenerationCount, visibleRecords, t]);

    const itemWidth = React.useMemo(() => {
        if (!listWidth || columns <= 0) return 0;
        return (listWidth - CARD_GAP * (columns - 1)) / columns;
    }, [columns, listWidth]);
    const rowHeight = React.useMemo(() => {
        if (!itemWidth) return 0;
        return itemWidth + CARD_FOOTER_HEIGHT + CARD_GAP;
    }, [itemWidth]);

    React.useEffect(() => {
        const root = listContainerRef.current;
        if (!root) return;

        const onScroll = () => setScrollTop(root.scrollTop);

        const measure = () => {
            const width = root.clientWidth - SCROLLBAR_GUTTER_WIDTH;
            const nextColumns =
                width >= 1024 ? 4 : width >= 768 ? 3 : width >= 640 ? 3 : 2;
            setColumns(nextColumns);
            setListWidth(width);
            setContainerHeight(root.clientHeight);
        };

        const resizeObserver = new ResizeObserver(() => {
            measure();
        });

        resizeObserver.observe(root);
        root.addEventListener('scroll', onScroll);
        measure();

        return () => {
            root.removeEventListener('scroll', onScroll);
            resizeObserver.disconnect();
        };
    }, []);

    const totalRows = React.useMemo(() => {
        if (!allItems.length || columns <= 0) return 0;
        return Math.ceil(allItems.length / columns);
    }, [allItems.length, columns]);

    const visibleRange = React.useMemo(() => {
        if (rowHeight === 0 || allItems.length === 0) {
            return { start: 0, end: 0 };
        }
        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight));
        const visibleRows = containerHeight > 0 ? Math.ceil(containerHeight / rowHeight) : 8;
        const start = Math.max(0, startRow - 2) * columns;
        const end = Math.min(allItems.length, (startRow + visibleRows + 2) * columns);
        return { start, end };
    }, [allItems.length, columns, containerHeight, rowHeight, scrollTop]);

    const totalHeight = totalRows * rowHeight;

    React.useEffect(() => {
        if (model || imageModels.length === 0) return;
        setModel(imageModels[0].id);
    }, [imageModels, model]);

    const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt || isGenerating) return;
        if (!model) {
            setError(t('Image generation is not configured'));
            return;
        }
        setIsGenerating(true);
        setPendingGenerationCount(count);
        setError(null);
        setLastBatchSummary(null);
        try {
            const requestedCount = count;
            const images = await onGenerate({ prompt: trimmedPrompt, model, size, n: count });
            const now = Date.now();
            await persistImages(
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
            setLastBatchSummary(
                t('Generated <lcur>generated<rcur> of <lcur>requested<rcur> images', {
                    generated: images.length,
                    requested: requestedCount
                })
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : t('Image generation failed'));
        } finally {
            setPendingGenerationCount(0);
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
            setError(err instanceof Error ? err.message : t('Could not send the image to video'));
        } finally {
            setAnimatingId(null);
        }
    };

    const openPreview = (rec: ImageRecord) => {
        const src = getSrc(rec);
        if (!src) return;
        setPreviewImage({ src, prompt: rec.prompt });
    };

    const stopCardAction = (event: React.MouseEvent) => {
        event.stopPropagation();
    };

    return (
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-[330px_minmax(0,1fr)] lg:items-start xl:grid-cols-[330px_minmax(0,1fr)]'>
            <Card className='flex w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
                <CardHeader className='border-b border-white/10 pb-4'>
                    <CardTitle className='text-base font-medium text-white'>{t('Create image')}</CardTitle>
                    <CardDescription className='mt-1 text-xs leading-5 text-white/55'>{t('Generate images and add them to videos')}</CardDescription>
                </CardHeader>
                <form onSubmit={handleGenerate}>
                <CardContent className='space-y-4 p-3.5'>
                    <div className='space-y-1.5'>
                        <Label htmlFor='image-prompt' className='text-xs font-normal tracking-tight text-white/85'>
                            {t('Prompt')}
                        </Label>
                        <Textarea
                            id='image-prompt'
                            placeholder={t('Example prompt')}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            required
                            disabled={isGenerating}
                            className='min-h-[84px] resize-none rounded-md border border-white/20 bg-black text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                    </div>

                        <div className='grid grid-cols-2 gap-4'>
                            <div className='space-y-2'>
                                <Label htmlFor='image-model' className='text-xs font-normal tracking-tight text-white/85'>
                                    {t('Model')}
                                </Label>
                                <Select
                                    value={model}
                                    onValueChange={setModel}
                                    disabled={isGenerating || imageModels.length === 0}>
                                    <SelectTrigger
                                        id='image-model'
                                        className='h-9 rounded-md border border-white/20 bg-black text-sm text-white focus:border-white/50 focus:ring-white/50'>
                                        <SelectValue placeholder={t('No models')} />
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
                                <Label htmlFor='image-size' className='text-xs font-normal tracking-tight text-white/85'>
                                    {t('Size')}
                                </Label>
                                <Select value={size} onValueChange={(v) => setSize(v as ImageSizeId)} disabled={isGenerating}>
                                    <SelectTrigger
                                        id='image-size'
                                        className='h-9 rounded-md border border-white/20 bg-black text-sm text-white focus:border-white/50 focus:ring-white/50'>
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
                            <Label className='text-xs font-normal tracking-tight text-white/85'>{t('Count')}</Label>
                                <div className='flex gap-2'>
                                    {[1, 2, 3, 4].map((n) => (
                                        <button
                                            key={n}
                                            type='button'
                                            onClick={() => setCount(n)}
                                            disabled={isGenerating}
                                            aria-pressed={count === n}
                                            className={cn(
                                                'h-7 w-7 rounded-md text-xs transition-colors',
                                                count === n
                                                    ? 'bg-white text-black'
                                                    : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                                            )}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && <p className='text-xs text-red-400/90'>{error}</p>}
                        {isGenerating ? (
                            <p className='flex items-center gap-1 text-[11px] leading-4 text-white/55'>
                                <Loader2 className='h-3 w-3 animate-spin' />
                                {t('Generating')}
                            </p>
                        ) : lastBatchSummary && !error ? (
                            <p className='text-xs text-white/50'>{lastBatchSummary}</p>
                        ) : null}

                        <Button
                            type='submit'
                            disabled={isGenerating || !prompt.trim() || !model}
                            className='w-full bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                            {t('Generating')} {count}
                                        </>
                                    ) : (
                                <>
                                    <Sparkles className='mr-2 h-4 w-4' />
                                    {t('Generate')}
                                </>
                            )}
                        </Button>
                    </CardContent>
                </form>
            </Card>

            <Card className='flex min-h-[400px] w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
                <CardHeader className='border-b border-white/10 pb-4'>
                    <CardTitle className='text-lg font-medium text-white'>{t('Images')}</CardTitle>
                    <CardDescription className='mt-1 text-white/60'>
                        {t('Stored locally and in your cloud assets and can be used in videos')}
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex-1 p-4'>
                    <style jsx>{`
                        .studio-image-list::-webkit-scrollbar {
                            width: 2px;
                            height: 2px;
                        }
                        .studio-image-list::-webkit-scrollbar-thumb {
                            border-radius: 9999px;
                            background-color: rgba(255, 255, 255, 0.25);
                        }
                        .studio-image-list::-webkit-scrollbar-thumb:hover {
                            background-color: rgba(255, 255, 255, 0.45);
                        }
                        .studio-image-list {
                            scrollbar-width: thin;
                            scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
                        }
                    `}</style>
                    <div
                        ref={listContainerRef}
                        className='studio-image-list flex-1 overflow-y-auto'
                        style={{ maxHeight: 'min(72vh, 760px)', position: 'relative' }}>
                        {allItems.length === 0 ? (
                            <div className='flex h-full min-h-[280px] flex-col items-center justify-center text-white/40'>
                                <ImageIcon className='mb-3 h-10 w-10 text-white/20' />
                                <p>{t('Generated and cloud images will appear here')}</p>
                            </div>
                        ) : (
                            <div style={{ position: 'relative', minHeight: `${totalHeight}px` }}>
                                {allItems.slice(visibleRange.start, visibleRange.end).map((item, visibleIndex) => {
                                    const itemIndex = visibleRange.start + visibleIndex;
                                    const rowIndex = Math.floor(itemIndex / columns);
                                    const colIndex = itemIndex % columns;
                                    const left = colIndex * (itemWidth + CARD_GAP);
                                    const top = rowIndex * rowHeight;

                                    if (item.kind === 'pending') {
                                        return (
                                            <div
                                                key={item.id}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${left}px`,
                                                    top: `${top}px`,
                                                    width: `${itemWidth}px`
                                                }}
                                                className='flex flex-col overflow-hidden rounded-lg border border-white/15 bg-neutral-900/70'>
                                                <div className='relative aspect-square overflow-hidden border-b border-white/15 bg-neutral-900/70'>
                                                    <div className='flex h-full items-center justify-center'>
                                                        <Loader2 className='h-6 w-6 animate-spin text-white/60' />
                                                    </div>
                                                </div>
                                                <div className='space-y-1.5 border-t border-white/15 bg-neutral-900/60 p-2.5'>
                                                    <p className='line-clamp-1 text-xs leading-4 text-white/50' title={item.prompt}>
                                                        {item.prompt}
                                                    </p>
                                                    <div className='grid grid-cols-2 gap-1.5'>
                                                        <span className='flex min-w-0 items-center justify-center whitespace-nowrap rounded bg-white/10 px-2 py-1 text-xs text-white/40'>
                                                            <Download size={11} className='mr-1' />
                                                            {t('Save')}
                                                        </span>
                                                        {onAnimate && (
                                                            <span className='flex min-w-0 items-center justify-center whitespace-nowrap rounded bg-white/10 px-2 py-1 text-xs text-white/40'>
                                                                <Clapperboard size={11} className='mr-1' />
                                                                {t('Animate')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    const rec = item.record;
                                    const src = getSrc(rec);
                                    const isCloudAsset = rec.id.startsWith('asset:');
                                    return (
                                        <div
                                            key={rec.id}
                                            style={{
                                                position: 'absolute',
                                                left: `${left}px`,
                                                top: `${top}px`,
                                                width: `${itemWidth}px`
                                            }}
                                            className='flex flex-col overflow-hidden rounded-lg border border-white/15 bg-neutral-900/70'>
                                            <div
                                                role='button'
                                                tabIndex={0}
                                                onClick={() => openPreview(rec)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        openPreview(rec);
                                                    }
                                                }}
                                                className='group relative aspect-square overflow-hidden border-b border-white/15 bg-neutral-900 transition hover:brightness-105'>
                                                {src ? (
                                                    // eslint-disable-next-line @next/next/no-img-element -- blob/worker URL, not a static asset
                                                    <img src={src} alt={rec.prompt} className='h-full w-full object-cover' />
                                                ) : (
                                                    <div className='flex h-full items-center justify-center text-white/30'>
                                                        {t('Media expired')}
                                                    </div>
                                                )}
                                                <span className='pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white/90'>
                                                    {isCloudAsset ? t('Cloud') : t('Local')}
                                                </span>
                                                <span className='pointer-events-none absolute inset-0 grid place-items-center bg-black/0 p-2 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100'>
                                                    <span className='inline-flex items-center gap-1 rounded bg-white/15 px-2 py-1 text-[11px] text-white'>
                                                        <Expand size={12} />
                                                        {t('Preview')}
                                                    </span>
                                                </span>
                                                {!isCloudAsset && (
                                                    <button
                                                        type='button'
                                                        onClick={(event) => {
                                                            stopCardAction(event);
                                                            void removeImage(rec.id);
                                                        }}
                                                        className='absolute right-1 top-1 rounded-full bg-red-600/80 p-1 text-[var(--studio-status-foreground)] transition-colors hover:bg-red-500/90'
                                                        aria-label={t('Delete image')}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className='space-y-1.5 border-t border-white/15 bg-neutral-900/60 p-2.5'>
                                                <p className='line-clamp-1 text-xs leading-4 text-white/75' title={rec.prompt}>
                                                    {rec.prompt}
                                                </p>
                                                <div className='grid grid-cols-2 gap-1.5'>
                                                    <button
                                                        type='button'
                                                        onClick={(event) => {
                                                            stopCardAction(event);
                                                            handleDownload(rec);
                                                        }}
                                                        className='flex min-w-0 items-center justify-center whitespace-nowrap rounded bg-white/10 px-2 py-1 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                        <Download size={11} />
                                                        {t('Save')}
                                                    </button>
                                                    {onAnimate && (
                                                        <button
                                                            type='button'
                                                            onClick={(event) => {
                                                                stopCardAction(event);
                                                                void handleAnimate(rec);
                                                            }}
                                                            disabled={animatingId !== null}
                                                            title={t('Use this image as a first frame in the video')}
                                                            className='flex min-w-0 items-center justify-center whitespace-nowrap rounded bg-white/10 px-2 py-1 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-40'>
                                                            {animatingId === rec.id ? (
                                                                <Loader2 size={11} className='animate-spin' />
                                                            ) : (
                                                                <Clapperboard size={11} />
                                                            )}
                                                            {t('Animate')}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
            <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
                <DialogContent className='max-h-[90vh] w-auto border-neutral-700 bg-neutral-950 p-3 text-white sm:max-w-[90vw]'>
                    <DialogHeader className='px-1 pb-2'>
                        <DialogTitle className='text-white'>{t('Image preview')}</DialogTitle>
                        <DialogDescription className='sr-only'>{t('Image preview')}</DialogDescription>
                    </DialogHeader>
                    <div className='space-y-2'>
                        <div className='overflow-hidden rounded-md border border-white/15 bg-black'>
                            {previewImage ? (
                                // eslint-disable-next-line @next/next/no-img-element -- blob/worker URL, not a static asset
                                <img
                                    src={previewImage.src}
                                    alt={previewImage.prompt}
                                    className='h-auto max-h-[76vh] w-full max-w-[86vw] object-contain'
                                />
                            ) : null}
                        </div>
                        <p className='line-clamp-2 px-1 text-xs text-white/65'>{previewImage?.prompt}</p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
