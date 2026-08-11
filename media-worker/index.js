/**
 * xcity-media — permanent home for generated video.
 *
 * Ark hands back signed CDN links that expire after 24h, and that CDN sends no
 * CORS headers (so a browser can play the file but never read its bytes).
 * This worker copies a finished video into R2 once and serves it forever from
 * our own origin, with CORS and range support.
 *
 *   POST /archive        { video_id, source_url }   -> { url, key, bytes, cached }
 *   POST /upload         <raw image/audio/video bytes> -> { url, key, bytes, cached }
 *   GET  /assets                                    -> { assets: [{key, url, bytes, uploaded, kind, name}] }
 *   POST /assets/delete  { key }                    -> { ok }
 *   GET  /media/<key>                               -> the file (public, immutable)
 *
 * Uploads are authenticated with the caller's TokenHub virtual key, verified
 * against the gateway — this is not open storage. Objects are namespaced per
 * user so one user's key cannot overwrite another's video.
 */

// no-store: Cloudflare's edge happily caches plain 404/error responses for
// GETs, which then poison later fetches of the same URL (observed on /assets;
// Ark's image download would hit the same trap after a delete + re-upload).
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function corsHeaders(origin, env) {
    const allowed = (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const ok = origin && (allowed.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin));
    if (!ok) return {};
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Asset-Name',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin'
    };
}

function json(body, status, extraHeaders) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...JSON_HEADERS, ...extraHeaders }
    });
}

/**
 * Verifies the bearer against the gateway and returns a stable per-user
 * namespace. Falls back to a hash of the key when the gateway reports no
 * user_id, so objects are still segregated.
 */
async function resolveOwner(bearer, env) {
    const base = (env.LITELLM_BASE_URL || '').replace(/\/+$/, '');
    const res = await fetch(`${base}/key/info`, {
        headers: { Authorization: `Bearer ${bearer}` }
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    const userId = body?.info?.user_id;
    if (userId) return `u/${userId}`;
    return `k/${await sha256Hex(bearer)}`;
}

async function sha256Hex(value) {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
}

/** Video ids are gateway-issued base64; keep only what is safe in a path. */
function safeVideoId(id) {
    return String(id)
        .replace(/[^A-Za-z0-9._-]/g, '')
        .slice(0, 120);
}

/** Upload types accepted for reference media. */
const UPLOAD_TYPES = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm'
};

function assetNameFromHeader(request) {
    const raw = request.headers.get('x-asset-name');
    if (!raw) return null;
    let decoded;
    try {
        decoded = decodeURIComponent(raw);
    } catch {
        decoded = raw;
    }
    const name = decoded.trim().slice(0, 80);
    return name || null;
}

/**
 * POST /upload — store a reference media file and hand back a public URL.
 *
 * The gateway takes a URL for picked local reference media, so users need
 * somewhere public to put it first. Content-addressed (sha256), so
 * re-uploading the same media is free and idempotent.
 */
async function handleUpload(request, env, cors) {
    const auth = request.headers.get('authorization') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!bearer) {
        return json({ error: 'missing bearer token' }, 401, cors);
    }

    const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
    const ext = UPLOAD_TYPES[contentType];
    if (!ext) {
        return json(
            { error: `unsupported content-type (want one of: ${Object.keys(UPLOAD_TYPES).join(', ')})` },
            415,
            cors
        );
    }

    const body = await request.arrayBuffer();
    const isAudio = contentType.startsWith('audio/');
    const isVideo = contentType.startsWith('video/');
    // MAX_UPLOAD_BYTES (prod: 10 MB) governs images; audio/video get fixed
    // ceilings to match the client-side caps in media-archive.ts.
    const maxUpload = isVideo
        ? 20 * 1024 * 1024
        : isAudio
          ? 15 * 1024 * 1024
          : Number(env.MAX_UPLOAD_BYTES || 0) || 10 * 1024 * 1024;
    if (body.byteLength === 0) {
        return json({ error: 'empty body' }, 400, cors);
    }
    if (body.byteLength > maxUpload) {
        return json({ error: `upload is ${body.byteLength} bytes, over the ${maxUpload} limit` }, 413, cors);
    }

    const owner = await resolveOwner(bearer, env);
    if (!owner) {
        return json({ error: 'invalid or unauthorized key' }, 403, cors);
    }

    const hash = await sha256Hex(body);
    const prefix = isVideo ? 'videos' : isAudio ? 'audio' : 'refs';
    const key = `${owner}/${prefix}/${hash}.${ext}`;
    const publicUrl = `${new URL(request.url).origin}/media/${key}`;

    const existing = await env.XCITY_MEDIA.head(key);
    if (existing) {
        return json({ url: publicUrl, key, bytes: existing.size, cached: true }, 200, cors);
    }

    const name = assetNameFromHeader(request);
    await env.XCITY_MEDIA.put(key, body, {
        httpMetadata: {
            contentType,
            cacheControl: 'public, max-age=31536000, immutable'
        },
        ...(name ? { customMetadata: { name } } : {})
    });

    return json({ url: publicUrl, key, bytes: body.byteLength, cached: false }, 200, cors);
}

/** Shared bearer → owner resolution for the asset-management endpoints. */
async function authOwner(request, env, cors) {
    const auth = request.headers.get('authorization') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!bearer) {
        return { error: json({ error: 'missing bearer token' }, 401, cors) };
    }
    const owner = await resolveOwner(bearer, env);
    if (!owner) {
        return { error: json({ error: 'invalid or unauthorized key' }, 403, cors) };
    }
    return { owner };
}

/**
 * GET /assets — everything stored under the caller's namespace: uploaded
 * reference images (`<owner>/refs/…`), audio (`<owner>/audio/…`),
 * reference videos (`<owner>/videos/…`), and archived videos
 * (`<owner>/<id>.mp4`).
 */
async function handleAssetsList(request, env, cors) {
    const { owner, error } = await authOwner(request, env, cors);
    if (error) return error;

    const origin = new URL(request.url).origin;
    const assets = [];
    let cursor;
    // Cap the walk at ~2000 objects — far above any real user's asset count,
    // low enough to keep the request bounded.
    for (let page = 0; page < 2; page++) {
        const listed = await env.XCITY_MEDIA.list({
            prefix: `${owner}/`,
            limit: 1000,
            cursor,
            include: ['customMetadata']
        });
        for (const obj of listed.objects) {
            const kind = obj.key.startsWith(`${owner}/refs/`)
                ? 'image'
                : obj.key.startsWith(`${owner}/audio/`)
                  ? 'audio'
                  : 'video';
            assets.push({
                key: obj.key,
                url: `${origin}/media/${obj.key}`,
                bytes: obj.size,
                uploaded: obj.uploaded ? new Date(obj.uploaded).toISOString() : null,
                kind,
                name: obj.customMetadata?.name ?? null
            });
        }
        if (!listed.truncated) break;
        cursor = listed.cursor;
    }

    // Newest first — the panel shows recent work at the top.
    assets.sort((a, b) => (b.uploaded || '').localeCompare(a.uploaded || ''));
    return json({ assets }, 200, cors);
}

/** POST /assets/delete { key } — remove one object from the caller's namespace. */
async function handleAssetsDelete(request, env, cors) {
    const { owner, error } = await authOwner(request, env, cors);
    if (error) return error;

    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ error: 'invalid JSON body' }, 400, cors);
    }
    const key = typeof payload?.key === 'string' ? payload.key : '';
    // Namespace check is the authorization: a key can only delete its own objects.
    if (!key || !key.startsWith(`${owner}/`)) {
        return json({ error: 'key is missing or outside your namespace' }, 403, cors);
    }

    await env.XCITY_MEDIA.delete(key);
    return json({ ok: true, key }, 200, cors);
}

async function handleArchive(request, env, cors) {
    const auth = request.headers.get('authorization') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!bearer) {
        return json({ error: 'missing bearer token' }, 401, cors);
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ error: 'invalid JSON body' }, 400, cors);
    }

    const videoId = safeVideoId(payload?.video_id || '');
    const sourceUrl = payload?.source_url;
    if (!videoId || !sourceUrl) {
        return json({ error: 'video_id and source_url are required' }, 400, cors);
    }

    let source;
    try {
        source = new URL(sourceUrl);
    } catch {
        return json({ error: 'source_url is not a valid URL' }, 400, cors);
    }
    // Only copy from the provider's own storage — this endpoint must not become
    // an open proxy that fetches arbitrary hosts on our behalf.
    if (source.protocol !== 'https:' || !/(^|\.)volces\.com$/.test(source.hostname)) {
        return json({ error: 'source_url host is not allowed' }, 400, cors);
    }

    const owner = await resolveOwner(bearer, env);
    if (!owner) {
        return json({ error: 'invalid or unauthorized key' }, 403, cors);
    }

    const key = `${owner}/${videoId}.mp4`;

    const existing = await env.XCITY_MEDIA.head(key);
    if (existing) {
        return json(
            { url: `${new URL(request.url).origin}/media/${key}`, key, bytes: existing.size, cached: true },
            200,
            cors
        );
    }

    const upstream = await fetch(source.toString());
    if (!upstream.ok || !upstream.body) {
        return json({ error: `source fetch failed (${upstream.status})` }, 502, cors);
    }

    const declared = Number(upstream.headers.get('content-length') || 0);
    const maxBytes = Number(env.MAX_BYTES || 0) || 209715200;
    if (declared && declared > maxBytes) {
        return json({ error: `source is ${declared} bytes, over the ${maxBytes} limit` }, 413, cors);
    }

    const stored = await env.XCITY_MEDIA.put(key, upstream.body, {
        httpMetadata: {
            contentType: upstream.headers.get('content-type') || 'video/mp4',
            cacheControl: 'public, max-age=31536000, immutable'
        }
    });

    return json(
        {
            url: `${new URL(request.url).origin}/media/${key}`,
            key,
            bytes: stored?.size ?? declared ?? null,
            cached: false
        },
        200,
        cors
    );
}

async function handleMedia(request, env, key, cors) {
    const notFoundHeaders = { ...cors, 'Cache-Control': 'no-store' };
    if (!key) return new Response('Not Found', { status: 404, headers: notFoundHeaders });

    // Range support so the <video> element can seek without pulling the file.
    const range = request.headers.get('range');
    const object = await env.XCITY_MEDIA.get(key, range ? { range: request.headers } : undefined);
    if (!object) return new Response('Not Found', { status: 404, headers: notFoundHeaders });

    const headers = new Headers(cors);
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    // Playback is cross-origin; without this only same-origin pages could read it.
    if (!headers.has('Access-Control-Allow-Origin')) {
        headers.set('Access-Control-Allow-Origin', '*');
    }

    if (object.range && object.size != null) {
        const start = object.range.offset ?? 0;
        const length = object.range.length ?? object.size - start;
        headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${object.size}`);
        return new Response(object.body, { status: 206, headers });
    }

    return new Response(object.body, { headers });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get('origin');
        const cors = corsHeaders(origin, env);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: Object.keys(cors).length ? 204 : 403, headers: cors });
        }

        if (url.pathname === '/archive' && request.method === 'POST') {
            return handleArchive(request, env, cors);
        }

        if (url.pathname === '/upload' && request.method === 'POST') {
            return handleUpload(request, env, cors);
        }

        if (url.pathname === '/assets' && request.method === 'GET') {
            return handleAssetsList(request, env, cors);
        }

        if (url.pathname === '/assets/delete' && request.method === 'POST') {
            return handleAssetsDelete(request, env, cors);
        }

        if (url.pathname.startsWith('/media/')) {
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                return new Response('Method Not Allowed', { status: 405, headers: cors });
            }
            return handleMedia(request, env, decodeURIComponent(url.pathname.slice('/media/'.length)), cors);
        }

        if (url.pathname === '/health') {
            return json({ ok: true }, 200, cors);
        }

        return new Response('Not Found', { status: 404, headers: { ...cors, 'Cache-Control': 'no-store' } });
    }
};
