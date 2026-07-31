import type { VideoJobCreate } from '@/types/video';

/**
 * Showcase gallery — curated clips we own, shown as a wall of examples users
 * can watch and then reuse ("做同款").
 *
 * Media lives in R2 under `gallery/v1/{slug}/` and is served by the media
 * worker's public, immutable, CORS-enabled `/media/{key}` route, so the
 * gallery needs no new backend. The manifest itself is a TS module rather
 * than JSON: `params` is typed as a real creation request, so a wrong model
 * id or an illegal model/resolution pair fails `npm run build` instead of
 * failing silently in front of a user.
 */

export const GALLERY_CATEGORIES = [
    { id: 'all', label: 'All' },
    { id: 'product', label: 'Product' },
    { id: 'character', label: 'Character' },
    { id: 'landscape', label: 'Landscape' },
    { id: 'animation', label: 'Animation' },
    { id: 'camera', label: 'Camera work' },
    { id: 'audio', label: 'With audio' }
] as const;

export type GalleryCategory = Exclude<(typeof GALLERY_CATEGORIES)[number]['id'], 'all'>;
export type GalleryFilter = (typeof GALLERY_CATEGORIES)[number]['id'];

export interface GalleryItem {
    /** URL-safe id; also the R2 folder name under gallery/v1/. */
    slug: string;
    title: string;
    category: GalleryCategory;
    /**
     * Exactly the shape the creation form submits — "做同款" is then an
     * assignment, not a translation.
     */
    params: VideoJobCreate;
    media: {
        /** Still frame shown in the grid. */
        poster: string;
        /** Short, muted, low-bitrate loop played on hover. Falls back to `video`. */
        preview?: string;
        /** Full clip, played in the detail dialog. */
        video: string;
    };
    /** Intrinsic size, so the masonry reserves space and nothing shifts. */
    dimensions: { width: number; height: number };
    /** Optional note on why this prompt works — the gallery doubles as teaching. */
    note?: string;
    featured?: boolean;
    /** Lower sorts first within the featured order. */
    order?: number;
}

/** Absolute URL for a media key, resolved against the runtime-configured worker. */
export function galleryMediaUrl(workerUrl: string, key: string): string {
    if (/^https?:\/\//.test(key)) return key;
    return `${workerUrl.replace(/\/+$/, '')}/media/${key.replace(/^\/+/, '')}`;
}

export function filterGallery(items: readonly GalleryItem[], filter: GalleryFilter): GalleryItem[] {
    const scoped =
        filter === 'all'
            ? [...items]
            : filter === 'audio'
              ? items.filter((i) => i.params.generate_audio)
              : items.filter((i) => i.category === filter);

    return scoped.sort(
        (a, b) => Number(b.featured) - Number(a.featured) || (a.order ?? 999) - (b.order ?? 999)
    );
}

/** Categories that actually have items, so the filter bar never offers a dead tab. */
export function availableCategories(items: readonly GalleryItem[]): GalleryFilter[] {
    return GALLERY_CATEGORIES.filter((c) => {
        if (c.id === 'all') return items.length > 0;
        if (c.id === 'audio') return items.some((i) => i.params.generate_audio);
        return items.some((i) => i.category === c.id);
    }).map((c) => c.id);
}

export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    return `${m}:${String(seconds % 60).padStart(2, '0')}`;
}
