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

import { StateConflictError } from './errors';

type RuntimeConfig = {
    mediaWorkerUrl: string;
    transcribeModel: string;
    ttsModel: string;
    portraitEnabled: boolean;
};

let runtimeConfigPromise: Promise<RuntimeConfig> | null = null;

function normalizeRuntimeConfig(cfg: Partial<RuntimeConfig>): RuntimeConfig {
    return {
        mediaWorkerUrl: (cfg.mediaWorkerUrl || '').trim().replace(/\/+$/, ''),
        transcribeModel: (cfg.transcribeModel || '').trim(),
        ttsModel: (cfg.ttsModel || '').trim(),
        portraitEnabled: Boolean(cfg.portraitEnabled)
    };
}

function loadRuntimeConfig(): Promise<RuntimeConfig> {
    if (!runtimeConfigPromise) {
        runtimeConfigPromise = fetch('/api/config')
            .then((res) => (res.ok ? res.json() : {}))
            .then((cfg: Partial<RuntimeConfig>) => normalizeRuntimeConfig(cfg))
            .catch(() => normalizeRuntimeConfig({}));
    }
    return runtimeConfigPromise;
}

function loadWorkerUrl(): Promise<string> {
    return loadRuntimeConfig().then((cfg) => cfg.mediaWorkerUrl);
}

/** Resolves once the runtime config says a media worker is configured. */
export async function mediaArchiveEnabled(): Promise<boolean> {
    return (await loadWorkerUrl()).length > 0;
}

/** Base worker URL ('' when unconfigured) — also serves the showcase gallery. */
export async function mediaWorkerUrl(): Promise<string> {
    return loadWorkerUrl();
}

/** Gateway transcription model configured at runtime ('' when disabled). */
export async function transcribeModel(): Promise<string> {
    return loadRuntimeConfig().then((cfg) => cfg.transcribeModel);
}

/** Gateway TTS model configured at runtime ('' when disabled). */
export async function ttsModel(): Promise<string> {
    return loadRuntimeConfig().then((cfg) => cfg.ttsModel);
}

/** Whether the BytePlus private real-human asset library is configured. */
export async function portraitEnabled(): Promise<boolean> {
    return loadRuntimeConfig().then((cfg) => cfg.portraitEnabled);
}

export interface ArchivedMedia {
    url: string;
    bytes: number | null;
    cached: boolean;
}

export interface CreatedShare {
    id: string;
    url: string;
}

export interface FetchedShare {
    prompt: string;
    params: unknown;
    title?: string;
}

export type CommunityReviewAction = 'approve' | 'reject';
export type CommunityPublishStatus = 'pending' | 'approved' | 'rejected';

export interface CommunityListItem {
    id: string;
    title: string;
    prompt: string;
    video_url: string;
    share_url: string;
    params: {
        model?: string;
        ratio?: string;
        resolution?: string;
        seconds?: number | string;
    };
    created_at: string;
}

export interface CommunityQueueItem {
    id: string;
    title: string;
    prompt: string;
    video_url: string;
    created_at: string;
    owner: string;
}

export async function createShare(
    input: { videoId: string; videoUrl: string; prompt: string; params: object; title?: string },
    apiKey: string
): Promise<CreatedShare> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) {
        throw new Error('Sharing is not configured on this deployment.');
    }

    const res = await fetch(`${workerUrl}/share`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            video_id: input.videoId,
            video_url: input.videoUrl,
            prompt: input.prompt,
            params: input.params,
            ...(input.title ? { title: input.title } : {})
        })
    });
    if (!res.ok) {
        const detail = await res
            .json()
            .then((d: { error?: string }) => d.error)
            .catch(() => undefined);
        throw new Error(detail || `Share failed (${res.status}).`);
    }

    const data = (await res.json()) as { id?: string; url?: string };
    if (!data.id || !data.url) {
        throw new Error('Share creation returned no URL.');
    }
    return { id: data.id, url: data.url };
}

export async function fetchShare(id: string): Promise<FetchedShare | null> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) return null;

    const safeId = id.trim();
    if (!/^[0-9a-z]{8}$/.test(safeId)) return null;

    const res = await fetch(`${workerUrl}/share/${encodeURIComponent(safeId)}.json`, {
        cache: 'no-store'
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error(`Could not load shared settings (${res.status}).`);
    }

    const data = (await res.json()) as { prompt?: unknown; params?: unknown; title?: unknown };
    if (typeof data.prompt !== 'string' || data.params === null || typeof data.params !== 'object') {
        return null;
    }
    return {
        prompt: data.prompt,
        params: data.params,
        ...(typeof data.title === 'string' && data.title ? { title: data.title } : {})
    };
}

export async function publishToCommunity(shareId: string, apiKey: string): Promise<CommunityPublishStatus> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) {
        throw new Error('Community publishing is not configured on this deployment.');
    }

    const res = await fetch(`${workerUrl}/community/publish`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ share_id: shareId })
    });
    if (!res.ok) {
        const detail = await res
            .json()
            .then((d: { error?: string }) => d.error)
            .catch(() => undefined);
        throw new Error(detail || `Community publish failed (${res.status}).`);
    }

    const data = (await res.json()) as { status?: CommunityPublishStatus };
    if (data.status !== 'pending' && data.status !== 'approved' && data.status !== 'rejected') {
        throw new Error('Community publish returned no status.');
    }
    return data.status;
}

export async function fetchCommunityQueue(apiKey: string): Promise<CommunityQueueItem[] | null> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) return null;

    const res = await fetch(`${workerUrl}/community/queue`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store'
    });
    if (res.status === 403) return null;
    if (!res.ok) {
        throw new Error(`Could not load review queue (${res.status}).`);
    }
    const data = (await res.json()) as { items?: CommunityQueueItem[] };
    return data.items ?? [];
}

export async function reviewCommunityItem(
    shareId: string,
    action: CommunityReviewAction,
    apiKey: string
): Promise<CommunityPublishStatus> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) {
        throw new Error('Community review is not configured on this deployment.');
    }

    const res = await fetch(`${workerUrl}/community/review`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ share_id: shareId, action })
    });
    if (!res.ok) {
        const detail = await res
            .json()
            .then((d: { error?: string }) => d.error)
            .catch(() => undefined);
        throw new Error(detail || `Community review failed (${res.status}).`);
    }

    const data = (await res.json()) as { status?: CommunityPublishStatus };
    if (data.status !== 'pending' && data.status !== 'approved' && data.status !== 'rejected') {
        throw new Error('Community review returned no status.');
    }
    return data.status;
}

export async function fetchCommunityList(): Promise<CommunityListItem[]> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) return [];

    const res = await fetch(`${workerUrl}/community/list`, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Could not load community videos (${res.status}).`);
    }
    const data = (await res.json()) as { items?: Omit<CommunityListItem, 'share_url'>[] };
    return (data.items ?? []).map((item) => ({
        ...item,
        share_url: `${workerUrl}/share/${encodeURIComponent(item.id)}`
    }));
}

/**
 * Copies a finished video into R2. Best-effort: returns null on any failure so
 * callers keep the provider URL rather than surfacing an error — the video is
 * watchable either way, archiving only decides whether it still is tomorrow.
 */
export async function archiveVideo(videoId: string, sourceUrl: string, apiKey: string): Promise<ArchivedMedia | null> {
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
    kind: 'image' | 'audio' | 'video';
    name: string | null;
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

export async function fetchCloudState(apiKey: string): Promise<{ doc: unknown; etag: string } | null> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) return null;

    const res = await fetch(`${workerUrl}/state`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store'
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error(`Could not load cloud history (${res.status}).`);
    }

    const etag = res.headers.get('etag');
    if (!etag) {
        throw new Error('Cloud history response returned no ETag.');
    }

    return { doc: (await res.json()) as unknown, etag };
}

export async function pushCloudState(doc: unknown, apiKey: string, etag: string | null): Promise<string> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) {
        throw new Error('Cloud history sync is not configured on this deployment.');
    }

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    if (etag) {
        headers['If-Match'] = etag;
    }

    const res = await fetch(`${workerUrl}/state`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(doc)
    });
    if (res.status === 412) {
        throw new StateConflictError();
    }
    if (!res.ok) {
        const detail = await res
            .json()
            .then((d: { error?: string }) => d.error)
            .catch(() => undefined);
        throw new Error(detail || `Could not save cloud history (${res.status}).`);
    }

    const data = (await res.json()) as { etag?: string };
    if (!data.etag) {
        throw new Error('Cloud history save returned no ETag.');
    }
    return data.etag;
}

async function urlToDataUri(url: string, accepts: (blob: Blob) => boolean): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!accepts(blob)) return null;
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

/**
 * Fetches an image and returns it as a `data:` URI, or null when it cannot be
 * read (missing object, CORS-blocked host, non-image response). Used to
 * inline reference images into generation requests: Ark accepts Base64
 * directly, which sidesteps its fetcher being challenged by Cloudflare's bot
 * mitigation on our media host.
 */
export async function imageUrlToDataUri(url: string): Promise<string | null> {
    return urlToDataUri(url, (blob) => blob.type.startsWith('image/'));
}

/** Same as image inlining, but only accepts audio blobs. */
export async function audioUrlToDataUri(url: string): Promise<string | null> {
    return urlToDataUri(url, (blob) => blob.type.startsWith('audio/'));
}

/** Same as image inlining, but only accepts video blobs. */
export async function videoUrlToDataUri(url: string): Promise<string | null> {
    return urlToDataUri(url, (blob) => blob.type.startsWith('video/'));
}

const UPLOADABLE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const UPLOADABLE_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a']);
const UPLOADABLE_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 20 * 1024 * 1024;

function assetNameHeader(name?: string): Record<string, string> {
    const clean = name?.trim();
    return clean ? { 'X-Asset-Name': encodeURIComponent(clean) } : {};
}

/**
 * Uploads a local reference image to R2 and returns its public URL — the
 * gateway's image-to-video takes a URL, not bytes. Unlike archiving this is a
 * user-initiated action, so failures throw with a message worth showing.
 */
export async function uploadReferenceImage(file: File, apiKey: string, name?: string): Promise<string> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) {
        throw new Error('Image uploads are not configured on this deployment. Paste a public image URL instead.');
    }
    if (!UPLOADABLE_IMAGE_TYPES.has(file.type)) {
        throw new Error('Unsupported image type. Use PNG, JPEG, or WebP.');
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        throw new Error('Image is too large (max 10 MB).');
    }

    const res = await fetch(`${workerUrl}/upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': file.type,
            ...assetNameHeader(name)
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

export async function uploadReferenceAudio(file: File, apiKey: string, name?: string): Promise<string> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) {
        throw new Error('Audio uploads are not configured on this deployment. Paste a public audio URL instead.');
    }
    if (!UPLOADABLE_AUDIO_TYPES.has(file.type)) {
        throw new Error('Unsupported audio type. Use MP3, WAV, or M4A.');
    }
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
        throw new Error('Audio is too large (max 15 MB).');
    }

    const res = await fetch(`${workerUrl}/upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': file.type,
            ...assetNameHeader(name)
        },
        body: file
    });
    if (!res.ok) {
        const detail = await res
            .json()
            .then((d: { error?: string }) => d.error)
            .catch(() => undefined);
        throw new Error(detail || `Audio upload failed (${res.status})`);
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) {
        throw new Error('Audio upload returned no URL.');
    }
    return data.url;
}

export async function uploadReferenceVideo(file: File, apiKey: string, name?: string): Promise<string> {
    const workerUrl = await loadWorkerUrl();
    if (!workerUrl) {
        throw new Error('Video uploads are not configured on this deployment. Paste a public video URL instead.');
    }
    if (!UPLOADABLE_VIDEO_TYPES.has(file.type)) {
        throw new Error('Unsupported video type. Use MP4, MOV, or WebM.');
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
        throw new Error('Video is too large (max 20 MB).');
    }

    const res = await fetch(`${workerUrl}/upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': file.type,
            ...assetNameHeader(name)
        },
        body: file
    });
    if (!res.ok) {
        const detail = await res
            .json()
            .then((d: { error?: string }) => d.error)
            .catch(() => undefined);
        throw new Error(detail || `Video upload failed (${res.status})`);
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) {
        throw new Error('Video upload returned no URL.');
    }
    return data.url;
}
