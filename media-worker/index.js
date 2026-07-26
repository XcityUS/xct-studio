/**
 * xcity-media — permanent home for generated video.
 *
 * Ark hands back signed CDN links that expire after 24h, and that CDN sends no
 * CORS headers (so a browser can play the file but never read its bytes).
 * This worker copies a finished video into R2 once and serves it forever from
 * our own origin, with CORS and range support.
 *
 *   POST /archive  { video_id, source_url }   -> { url, key, bytes, cached }
 *   GET  /media/<key>                         -> the video (public, immutable)
 *
 * Uploads are authenticated with the caller's TokenHub virtual key, verified
 * against the gateway — this is not open storage. Objects are namespaced per
 * user so one user's key cannot overwrite another's video.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function corsHeaders(origin, env) {
    const allowed = (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const ok =
        origin &&
        (allowed.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin));
    if (!ok) return {};
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
    };
}

function json(body, status, extraHeaders) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...JSON_HEADERS, ...extraHeaders },
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
        headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    const userId = body?.info?.user_id;
    if (userId) return `u/${userId}`;
    return `k/${await sha256Hex(bearer)}`;
}

async function sha256Hex(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
}

/** Video ids are gateway-issued base64; keep only what is safe in a path. */
function safeVideoId(id) {
    return String(id).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 120);
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
            cacheControl: 'public, max-age=31536000, immutable',
        },
    });

    return json(
        { url: `${new URL(request.url).origin}/media/${key}`, key, bytes: stored?.size ?? declared ?? null, cached: false },
        200,
        cors
    );
}

async function handleMedia(request, env, key, cors) {
    if (!key) return new Response('Not Found', { status: 404, headers: cors });

    // Range support so the <video> element can seek without pulling the file.
    const range = request.headers.get('range');
    const object = await env.XCITY_MEDIA.get(key, range ? { range: request.headers } : undefined);
    if (!object) return new Response('Not Found', { status: 404, headers: cors });

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

        if (url.pathname.startsWith('/media/')) {
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                return new Response('Method Not Allowed', { status: 405, headers: cors });
            }
            return handleMedia(request, env, decodeURIComponent(url.pathname.slice('/media/'.length)), cors);
        }

        if (url.pathname === '/health') {
            return json({ ok: true }, 200, cors);
        }

        return new Response('Not Found', { status: 404, headers: cors });
    },
};
