/**
 * Permanent storage for finished videos (Cloudflare R2 via the xcity-media
 * worker, see media-worker/).
 *
 * Ark's own CDN links expire after 24h and carry no CORS headers, so a video
 * referenced only by its provider URL becomes unplayable tomorrow and
 * unreadable to JS today. Archiving copies it once into our bucket and returns
 * a stable, CORS-enabled URL we can store in history.
 *
 * The worker URL is read at runtime from /api/config rather than a
 * NEXT_PUBLIC_ constant: those are inlined at build time and come out empty
 * whenever the build environment lacks the variable (which is exactly what
 * happened on Railway). No worker configured = archiving is skipped and
 * playback falls back to the provider URL.
 */

let workerUrlPromise: Promise<string> | null = null;

function loadWorkerUrl(): Promise<string> {
    if (!workerUrlPromise) {
        workerUrlPromise = fetch('/api/config')
            .then((res) => (res.ok ? res.json() : { mediaWorkerUrl: '' }))
            .then((cfg: { mediaWorkerUrl?: string }) => (cfg.mediaWorkerUrl || '').replace(/\/+$/, ''))
            .catch(() => '');
    }
    return workerUrlPromise;
}

/** Resolves once the runtime config says a media worker is configured. */
export async function mediaArchiveEnabled(): Promise<boolean> {
    return (await loadWorkerUrl()).length > 0;
}

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
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) return null;

    try {
        const res = await fetch(`${workerUrl}/archive`, {
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
