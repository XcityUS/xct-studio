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

/** Base worker URL ('' when unconfigured) — also serves the showcase gallery. */
export async function mediaWorkerUrl(): Promise<string> {
    return loadWorkerUrl();
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

export interface UserAsset {
    key: string;
    url: string;
    bytes: number | null;
    uploaded: string | null;
    kind: 'image' | 'video';
}

/** Lists everything the worker stores for this user (uploads + archived videos). */
export async function listUserAssets(apiKey: string): Promise<UserAsset[]> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) {
        throw new Error('Asset storage is not configured on this deployment.');
    }
    const res = await fetch(`${workerUrl}/assets`, {
        headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) {
        throw new Error(`Could not load assets (${res.status}).`);
    }
    const data = (await res.json()) as { assets?: UserAsset[] };
    return data.assets ?? [];
}

/** Deletes one stored object; the worker enforces the caller's namespace. */
export async function deleteUserAsset(key: string, apiKey: string): Promise<void> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) {
        throw new Error('Asset storage is not configured on this deployment.');
    }
    const res = await fetch(`${workerUrl}/assets/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
    });
    if (!res.ok) {
        const detail = await res
            .json()
            .then((d: { error?: string }) => d.error)
            .catch(() => undefined);
        throw new Error(detail || `Delete failed (${res.status}).`);
    }
}

/**
 * Fetches an image and returns it as a `data:` URI, or null when it cannot be
 * read (missing object, CORS-blocked host, non-image response). Used to
 * inline reference images into generation requests: Ark accepts Base64
 * directly, which sidesteps its fetcher being challenged by Cloudflare's bot
 * mitigation on our media host.
 */
export async function imageUrlToDataUri(url: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) return null;
        return await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

const UPLOADABLE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Uploads a local reference image to R2 and returns its public URL — the
 * gateway's image-to-video takes a URL, not bytes. Unlike archiving this is a
 * user-initiated action, so failures throw with a message worth showing.
 */
export async function uploadReferenceImage(file: File, apiKey: string): Promise<string> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) {
        throw new Error('Image uploads are not configured on this deployment. Paste a public image URL instead.');
    }
    if (!UPLOADABLE_TYPES.has(file.type)) {
        throw new Error('Unsupported image type. Use PNG, JPEG, or WebP.');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('Image is too large (max 10 MB).');
    }

    const res = await fetch(`${workerUrl}/upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': file.type
        },
        body: file
    });
    if (!res.ok) {
        const detail = await res
            .json()
            .then((d: { error?: string }) => d.error)
            .catch(() => undefined);
        throw new Error(detail || `Image upload failed (${res.status})`);
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) {
        throw new Error('Image upload returned no URL.');
    }
    return data.url;
}
