'use client';

import { formatDuration, galleryMediaUrl, type GalleryItem } from '@/lib/gallery';
import { Volume2 } from 'lucide-react';
import * as React from 'react';

/**
 * One clip in the wall. Deliberately chrome-free — no title, no metadata —
 * so the grid reads as a wall of images; everything else lives in the detail
 * dialog.
 *
 * The video element gets no `src` until first hover: mounting 30 loading
 * videos would cost more bandwidth than the page is worth. The poster stays
 * on top until the preview can actually paint, so hovering never flashes
 * black.
 */
export function GalleryCard({
    item,
    workerUrl,
    onOpen
}: {
    item: GalleryItem;
    workerUrl: string;
    onOpen: (item: GalleryItem) => void;
}) {
    const [src, setSrc] = React.useState<string | null>(null);
    const [playing, setPlaying] = React.useState(false);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    const previewKey = item.media.preview ?? item.media.video;
    const aspect = `${item.dimensions.width} / ${item.dimensions.height}`;

    const start = React.useCallback(() => {
        // Respect users who asked for less motion — they still get the poster.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        setSrc((prev) => prev ?? galleryMediaUrl(workerUrl, previewKey));
        void videoRef.current?.play().catch(() => {});
    }, [previewKey, workerUrl]);

    const stop = React.useCallback(() => {
        setPlaying(false);
        const v = videoRef.current;
        if (v) {
            v.pause();
            v.currentTime = 0;
        }
    }, []);

    return (
        <button
            type='button'
            onClick={() => onOpen(item)}
            onMouseEnter={start}
            onMouseLeave={stop}
            onFocus={start}
            onBlur={stop}
            aria-label={`${item.title} — open details`}
            className='group relative mb-2 block w-full overflow-hidden rounded-md border border-white/10 bg-white/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
            style={{ aspectRatio: aspect }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={galleryMediaUrl(workerUrl, item.media.poster)}
                alt={item.title}
                loading='lazy'
                decoding='async'
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                    playing ? 'opacity-0' : 'opacity-100'
                }`}
            />
            {src && (
                <video
                    ref={videoRef}
                    src={src}
                    muted
                    loop
                    playsInline
                    preload='none'
                    onPlaying={() => setPlaying(true)}
                    className='absolute inset-0 h-full w-full object-cover'
                />
            )}

            <div className='pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
                <span className='truncate text-left text-xs font-medium text-white'>{item.title}</span>
                <span className='flex shrink-0 items-center gap-1 text-[11px] text-white/70'>
                    {item.params.generate_audio && <Volume2 className='h-3 w-3' aria-label='Has audio' />}
                    {formatDuration(item.params.seconds)}
                </span>
            </div>
        </button>
    );
}
