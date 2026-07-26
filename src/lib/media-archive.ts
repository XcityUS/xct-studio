/**
 * Permanent storage for finished videos (Cloudflare R2 via the xcity-media
 * worker, see media-worker/).
 *
 * Ark's own CDN links expire after 24h and carry no CORS headers, so a video
 * that is only referenced by its provider URL becomes unplayable tomorrow and
 * unreadable to JS today. Archiving copies it once into our bucket and returns
 * a stable, CORS-enabled URL we can store in history.
 *
 * Disabled (and skipped silently) when NEXT_PUBLIC_MEDIA_WORKER_URL is unset —
 * playback then falls back to the provider URL, exactly as before.
 */

const WORKER_URL = (process.env.NEXT_PUBLIC_MEDIA_WORKER_URL || '').replace(/\/+$/, '');

export const MEDIA_ARCHIVE_ENABLED = WORKER_URL.length > 0;

export interface ArchivedMedia {
    url: string;
    bytes: number | null;
    cached: boolean;
}

/**
 * Copies a finished video into R2. Best-effort: returns null on any failure so
 * callers keep the provider URL rather than surfacing an error — the video is
 * watchable either way, archiving only decides whether it still is tomorrow.
 */
export async function archiveVideo(
    videoId: string,
    sourceUrl: string,
    apiKey: string
): Promise<ArchivedMedia | null> {
    if (!MEDIA_ARCHIVE_ENABLED) return null;

    try {
        const res = await fetch(`${WORKER_URL}/archive`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ video_id: videoId, source_url: sourceUrl })
        });
        if (!res.ok) {
            console.warn(`[media-archive] ${videoId} failed: ${res.status}`);
            return null;
        }
        const data = (await res.json()) as { url?: string; bytes?: number | null; cached?: boolean };
        if (!data.url) return null;
        return { url: data.url, bytes: data.bytes ?? null, cached: !!data.cached };
    } catch (err) {
        console.warn(`[media-archive] ${videoId} errored:`, err);
        return null;
    }
}
