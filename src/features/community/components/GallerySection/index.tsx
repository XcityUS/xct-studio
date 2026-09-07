'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { GalleryCard } from '@/features/community/components/GalleryCard';
import { GalleryDetailDialog } from '@/features/community/components/GalleryDetailDialog';
import { GALLERY_ITEMS } from '@/features/community/gallery/data';
import {
    GALLERY_CATEGORIES,
    availableCategories,
    filterGallery,
    galleryMediaUrl,
    type GalleryFilter,
    type GalleryItem
} from '@/features/community/gallery/utils';
import { mediaWorkerUrl } from '@/lib/media-archive';
import { useTranslations } from 'next-intl';
import * as React from 'react';

/**
 * The showcase wall. Renders nothing at all when the manifest is empty or the
 * media worker isn't configured, so it can ship before any clip exists.
 *
 * Masonry is CSS `columns`, not a JS layout library: order-by-column instead
 * of order-by-row is fine for a curated wall, and it costs no dependency and
 * no measurement pass.
 */
export function GallerySection({
    onUsePreset,
    onUseAsReference,
    limit
}: {
    onUsePreset: (item: GalleryItem) => void;
    onUseAsReference: (item: GalleryItem, frameUrl: string) => void;
    limit?: number;
}) {
    const t = useTranslations();
    const categoryLabels = {
        all: t('All'),
        product: t('Product'),
        character: t('Character'),
        landscape: t('Landscape'),
        animation: t('Animation'),
        camera: t('Camera work'),
        audio: t('With audio')
    };
    const [filter, setFilter] = React.useState<GalleryFilter>('all');
    const [selected, setSelected] = React.useState<GalleryItem | null>(null);
    const [workerUrl, setWorkerUrl] = React.useState<string>('');

    React.useEffect(() => {
        let cancelled = false;
        void mediaWorkerUrl().then((url) => {
            if (!cancelled) setWorkerUrl(url);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const categories = React.useMemo(() => availableCategories(GALLERY_ITEMS), []);
    const items = React.useMemo(() => {
        const filtered = filterGallery(GALLERY_ITEMS, filter);
        return limit ? filtered.slice(0, limit) : filtered;
    }, [filter, limit]);

    // Media lives on the worker; without it every tile would 404.
    if (GALLERY_ITEMS.length === 0 || !workerUrl) return null;

    return (
        <Card className='w-full rounded-lg border border-white/10 bg-black'>
            <CardHeader className='border-b border-white/10 pb-4'>
                <CardTitle className='text-lg font-medium text-white'>{t('Showcase')}</CardTitle>
                <CardDescription className='text-white/60'>
                    {t(
                        'Clips made with this studio<dot> Open one to see its prompt and settings <mdash> or reuse them'
                    )}
                </CardDescription>

                {categories.length > 2 && (
                    <div className='flex flex-wrap gap-1.5 pt-3'>
                        {GALLERY_CATEGORIES.filter((c) => categories.includes(c.id)).map((c) => (
                            <button
                                key={c.id}
                                type='button'
                                onClick={() => setFilter(c.id)}
                                aria-pressed={filter === c.id}
                                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                    filter === c.id
                                        ? 'border-white bg-white text-black'
                                        : 'border-white/15 text-white/70 hover:border-white/40 hover:text-white'
                                }`}>
                                {categoryLabels[c.id]}
                            </button>
                        ))}
                    </div>
                )}
            </CardHeader>

            <div className='p-4'>
                {items.length === 0 ? (
                    <p className='py-8 text-center text-sm text-white/40'>{t('Nothing in this category yet')}</p>
                ) : (
                    <div className='columns-1 gap-2 sm:columns-2 lg:columns-3'>
                        {items.map((item) => (
                            <div key={item.slug} className='break-inside-avoid'>
                                <GalleryCard item={item} workerUrl={workerUrl} onOpen={setSelected} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <GalleryDetailDialog
                item={selected}
                workerUrl={workerUrl}
                onClose={() => setSelected(null)}
                onUsePreset={(item) => {
                    setSelected(null);
                    onUsePreset(item);
                }}
                onUseAsReference={(item) => {
                    setSelected(null);
                    onUseAsReference(item, galleryMediaUrl(workerUrl, item.media.poster));
                }}
            />
        </Card>
    );
}
