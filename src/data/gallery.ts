import type { GalleryItem } from '@/lib/gallery';

/**
 * Curated showcase clips.
 *
 * Adding one:
 *   1. Put the files in R2 under `gallery/v1/{slug}/`:
 *        poster.webp   still frame (width ~640)
 *        preview.mp4   ~3s, 480p, muted, low bitrate — played on hover
 *        video.mp4     the full clip, played in the detail dialog
 *      `npm run gallery:upload -- ./local-folder {slug}` does this for you.
 *   2. Add an entry below. `params` is a real creation request, so TypeScript
 *      rejects an unknown model id or an unsupported model/resolution pair —
 *      run `npm run build` after editing.
 *
 * The gallery hides itself entirely while this list is empty, so shipping
 * with none is safe.
 */
export const GALLERY_ITEMS: GalleryItem[] = [
    // Example of the expected shape — delete once real clips land:
    //
    // {
    //     slug: 'iceland-black-sand',
    //     title: 'Black sand coastline',
    //     category: 'landscape',
    //     params: {
    //         model: 'seedance-1-5-pro-251215',
    //         prompt:
    //             'Aerial push along an Icelandic black sand beach at dawn, foam tracing the shoreline, low sun raking across volcanic grit',
    //         ratio: '21:9',
    //         resolution: '1080p',
    //         seconds: 8,
    //         generate_audio: false
    //     },
    //     media: {
    //         poster: 'gallery/v1/iceland-black-sand/poster.webp',
    //         preview: 'gallery/v1/iceland-black-sand/preview.mp4',
    //         video: 'gallery/v1/iceland-black-sand/video.mp4'
    //     },
    //     dimensions: { width: 2560, height: 1080 },
    //     note: 'Cinematic 21:9 needs a horizon line — name it in the prompt.',
    //     featured: true,
    //     order: 1
    // }
];
