/**
 * xcity-media — permanent home for generated video.
 *
 * Ark hands back signed CDN links that expire after 24h, and that CDN sends no
 * CORS headers (so a browser can play the file but never read its bytes).
 * This worker copies a finished video into R2 once and serves it forever from
 * our own origin, with CORS and range support.
 *
 *   POST /archive        { video_id, source_url }   -> { url, key, bytes, cached }
 *   GET  /archive/<id>                              -> { url, key, bytes, cached }
 *   POST /archive/<id>   <raw video bytes>          -> { url, key, bytes, cached }
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
const MAX_SHARE_PROMPT_CHARS = 4000;
const MAX_SHARE_PARAMS_BYTES = 8 * 1024;
const SHARE_ID_RE = /^[0-9a-z]{8}$/;
const COMMUNITY_INDEX_KEY = 'community/index.json';
const PRIVATE_REFERENCE_PARAM_KEYS = [
    'input_reference_url',
    'last_frame_url',
    'reference_image_urls',
    'reference_video_urls',
    'reference_audio_url'
];

function corsHeaders(origin, env) {
    const allowed = (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const ok = origin && (allowed.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin));
    if (!ok) return {};
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match, X-Asset-Name',
        'Access-Control-Expose-Headers': 'ETag',
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

function providerVideoHeaders() {
    return {
        Accept: 'video/mp4,video/*;q=0.9,*/*;q=0.8',
        Range: 'bytes=0-'
    };
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

function isAdmin(owner, env) {
    return (env.ADMIN_USER_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .some((id) => owner === `u/${id}`);
}

async function sha256Hex(value) {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
}

function isJsonObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function utf8Bytes(value) {
    return new TextEncoder().encode(value).byteLength;
}

function shareKey(id) {
    return `share/${id}.json`;
}

function safeShareId(id) {
    const value = typeof id === 'string' ? id.trim() : '';
    return SHARE_ID_RE.test(value) ? value : null;
}

function randomShareId() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    let n = 0n;
    for (const byte of bytes) {
        n = (n << 8n) + BigInt(byte);
    }
    return (n % 2821109907456n).toString(36).padStart(8, '0');
}

function stripPrivateReferenceParams(params) {
    const clean = { ...params };
    for (const key of PRIVATE_REFERENCE_PARAM_KEYS) {
        delete clean[key];
    }
    return clean;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
        switch (char) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
            default:
                return char;
        }
    });
}

function shareSetting(params, key) {
    if (!isJsonObject(params)) return '';
    const value = params[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}

function publicCommunityParams(params) {
    if (!isJsonObject(params)) return {};
    return ['model', 'ratio', 'resolution', 'seconds'].reduce((result, key) => {
        const value = params[key];
        if (typeof value === 'string' || typeof value === 'number') {
            result[key] = value;
        }
        return result;
    }, {});
}

/**
 * Video ids are gateway-issued base64; keep only what is safe in a path.
 * The encoded ids run ~150 chars and DIFFER ONLY IN THE TAIL (provider +
 * model prefix is identical), so a plain 120-char slice collided every
 * same-model archive onto one R2 key, overwriting each other. Long ids get
 * a hash suffix of the full value to stay unique.
 */
async function safeVideoId(id) {
    const sanitized = String(id).replace(/[^A-Za-z0-9._-]/g, '');
    if (sanitized.length <= 120) return sanitized;
    return `${sanitized.slice(0, 120)}-${(await sha256Hex(sanitized)).slice(0, 12)}`;
}

function archivedVideoKey(owner, videoId, ext = 'mp4') {
    return `${owner}/${videoId}.${ext}`;
}

function archivedVideoPayload(request, key, object, cached) {
    return {
        url: `${new URL(request.url).origin}/media/${key}`,
        key,
        bytes: object?.size ?? null,
        cached
    };
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
            if (obj.key.startsWith(`${owner}/state/`)) {
                continue;
            }
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

async function handleShareCreate(request, env, cors) {
    const { owner, error } = await authOwner(request, env, cors);
    if (error) return error;

    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ error: 'invalid JSON body' }, 400, cors);
    }

    const origin = new URL(request.url).origin;
    const videoId = typeof payload?.video_id === 'string' ? payload.video_id.trim() : '';
    const videoUrl = typeof payload?.video_url === 'string' ? payload.video_url.trim() : '';
    const prompt = payload?.prompt;
    const title = payload?.title == null ? '' : payload.title;

    if (!videoId || !videoUrl) {
        return json({ error: 'video_id and video_url are required' }, 400, cors);
    }
    if (!videoUrl.startsWith(`${origin}/media/${owner}/`)) {
        return json({ error: 'video_url is outside your hosted media namespace' }, 403, cors);
    }
    if (typeof prompt !== 'string') {
        return json({ error: 'prompt must be a string' }, 400, cors);
    }
    if (prompt.length > MAX_SHARE_PROMPT_CHARS) {
        return json({ error: `prompt is over the ${MAX_SHARE_PROMPT_CHARS} character limit` }, 413, cors);
    }
    if (!isJsonObject(payload?.params)) {
        return json({ error: 'params must be a JSON object' }, 400, cors);
    }
    if (typeof title !== 'string') {
        return json({ error: 'title must be a string' }, 400, cors);
    }
    if (title.length > 120) {
        return json({ error: 'title is over the 120 character limit' }, 413, cors);
    }

    const params = stripPrivateReferenceParams(payload.params);
    const paramsJson = JSON.stringify(params);
    if (utf8Bytes(paramsJson) > MAX_SHARE_PARAMS_BYTES) {
        return json({ error: 'params are over the 8 KB limit' }, 413, cors);
    }

    let id = '';
    for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = randomShareId();
        const existing = await env.XCITY_MEDIA.head(shareKey(candidate));
        if (!existing) {
            id = candidate;
            break;
        }
    }
    if (!id) {
        return json({ error: 'could not allocate share id' }, 500, cors);
    }

    const record = {
        id,
        owner,
        video_url: videoUrl,
        prompt,
        params,
        title,
        created_at: new Date().toISOString()
    };

    await env.XCITY_MEDIA.put(shareKey(id), JSON.stringify(record), {
        httpMetadata: {
            contentType: 'application/json',
            cacheControl: 'no-store'
        }
    });

    return json({ id, url: `${origin}/share/${id}` }, 200, cors);
}

async function readShareRecord(env, id) {
    const safeId = safeShareId(id);
    if (!safeId) return null;

    const object = await env.XCITY_MEDIA.get(shareKey(safeId));
    if (!object) return null;

    const record = await object.json().catch(() => null);
    if (!isJsonObject(record)) return null;
    if (record.id !== safeId || typeof record.video_url !== 'string' || typeof record.prompt !== 'string') {
        return null;
    }
    if (!isJsonObject(record.params)) {
        return null;
    }
    return record;
}

async function writeShareRecord(env, record) {
    await env.XCITY_MEDIA.put(shareKey(record.id), JSON.stringify(record), {
        httpMetadata: {
            contentType: 'application/json',
            cacheControl: 'no-store'
        }
    });
}

function normalizeCommunityIndex(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const entries = [];
    for (const entry of value) {
        if (!isJsonObject(entry)) continue;
        const id = safeShareId(entry.id);
        const approvedAt = typeof entry.approved_at === 'string' ? entry.approved_at : '';
        if (!id || !approvedAt || seen.has(id)) continue;
        seen.add(id);
        entries.push({ id, approved_at: approvedAt });
    }
    entries.sort((a, b) => b.approved_at.localeCompare(a.approved_at));
    return entries;
}

async function readCommunityIndex(env) {
    const object = await env.XCITY_MEDIA.get(COMMUNITY_INDEX_KEY);
    if (!object) {
        return { entries: [], etag: null };
    }
    const parsed = await object.json().catch(() => []);
    return { entries: normalizeCommunityIndex(parsed), etag: etagFromIfMatch(object.httpEtag || '') };
}

async function updateCommunityIndex(env, update) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const { entries, etag } = await readCommunityIndex(env);
        const next = normalizeCommunityIndex(update(entries));
        const onlyIf = etag ? { etagMatches: etag } : { etagDoesNotExist: true };
        const stored = await env.XCITY_MEDIA.put(COMMUNITY_INDEX_KEY, JSON.stringify(next), {
            onlyIf,
            httpMetadata: {
                contentType: 'application/json',
                cacheControl: 'no-store'
            }
        });
        if (stored) return true;
    }
    return false;
}

async function handleCommunityPublish(request, env, cors) {
    const { owner, error } = await authOwner(request, env, cors);
    if (error) return error;

    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ error: 'invalid JSON body' }, 400, cors);
    }

    const id = safeShareId(payload?.share_id);
    if (!id) {
        return json({ error: 'share_id is required' }, 400, cors);
    }

    const record = await readShareRecord(env, id);
    if (!record) {
        return json({ error: 'not found' }, 404, cors);
    }
    if (record.owner !== owner) {
        return json({ error: 'share is outside your namespace' }, 403, cors);
    }

    const status = record.plaza === 'pending' || record.plaza === 'approved' ? record.plaza : 'pending';
    if (record.plaza !== status) {
        record.plaza = status;
        await writeShareRecord(env, record);
    }

    return json({ status: record.plaza }, 200, cors);
}

async function handleCommunityQueue(request, env, cors) {
    const { owner, error } = await authOwner(request, env, cors);
    if (error) return error;
    if (!isAdmin(owner, env)) {
        return json({ error: 'admin access required' }, 403, cors);
    }

    const items = [];
    let cursor;
    let walked = 0;
    while (walked < 500) {
        const listed = await env.XCITY_MEDIA.list({
            prefix: 'share/',
            limit: Math.min(500 - walked, 1000),
            cursor
        });
        for (const obj of listed.objects) {
            walked++;
            const match = obj.key.match(/^share\/([0-9a-z]{8})\.json$/);
            if (!match) continue;
            const record = await readShareRecord(env, match[1]);
            if (record?.plaza !== 'pending') continue;
            items.push({
                id: record.id,
                title: typeof record.title === 'string' ? record.title : '',
                prompt: record.prompt,
                video_url: record.video_url,
                created_at: typeof record.created_at === 'string' ? record.created_at : '',
                owner: record.owner
            });
        }
        if (!listed.truncated) break;
        cursor = listed.cursor;
    }

    items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return json({ items }, 200, cors);
}

async function handleCommunityReview(request, env, cors) {
    const { owner, error } = await authOwner(request, env, cors);
    if (error) return error;
    if (!isAdmin(owner, env)) {
        return json({ error: 'admin access required' }, 403, cors);
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ error: 'invalid JSON body' }, 400, cors);
    }

    const id = safeShareId(payload?.share_id);
    const action = payload?.action;
    if (!id) {
        return json({ error: 'share_id is required' }, 400, cors);
    }
    if (action !== 'approve' && action !== 'reject') {
        return json({ error: 'action must be approve or reject' }, 400, cors);
    }

    const record = await readShareRecord(env, id);
    if (!record) {
        return json({ error: 'not found' }, 404, cors);
    }

    record.plaza = action === 'approve' ? 'approved' : 'rejected';
    await writeShareRecord(env, record);

    const approvedAt = new Date().toISOString();
    const indexUpdated =
        action === 'approve'
            ? await updateCommunityIndex(env, (entries) => [
                  { id, approved_at: approvedAt },
                  ...entries.filter((entry) => entry.id !== id)
              ])
            : await updateCommunityIndex(env, (entries) => entries.filter((entry) => entry.id !== id));

    if (!indexUpdated) {
        return json({ error: 'community index changed on another request' }, 409, cors);
    }

    return json({ status: record.plaza }, 200, cors);
}

async function handleCommunityList(env, cors) {
    const { entries } = await readCommunityIndex(env);
    const items = [];
    const staleIds = new Set();

    for (const entry of entries.slice(0, 100)) {
        const record = await readShareRecord(env, entry.id);
        if (!record || record.plaza !== 'approved') {
            staleIds.add(entry.id);
            continue;
        }
        items.push({
            id: record.id,
            title: typeof record.title === 'string' ? record.title : '',
            prompt: record.prompt,
            video_url: record.video_url,
            params: publicCommunityParams(record.params),
            created_at: typeof record.created_at === 'string' ? record.created_at : ''
        });
    }

    if (staleIds.size > 0) {
        try {
            await updateCommunityIndex(env, (current) => current.filter((entry) => !staleIds.has(entry.id)));
        } catch (err) {
            console.warn('Could not prune stale community index entries:', err);
        }
    }

    return json({ items }, 200, cors);
}

function renderShareHtml(record, env) {
    const title = record.title || 'Shared Xcity video';
    const pageTitle = `${title} | Xcity Studio`;
    const studioUrl = (env.STUDIO_URL || 'https://studio.xcity.ai').replace(/\/+$/, '');
    const recreateUrl = `${studioUrl}/?share=${encodeURIComponent(record.id)}`;
    const rows = [
        ['Model', shareSetting(record.params, 'model')],
        ['Ratio', shareSetting(record.params, 'ratio')],
        ['Resolution', shareSetting(record.params, 'resolution')],
        ['Seconds', shareSetting(record.params, 'seconds')]
    ]
        .filter(([, value]) => value)
        .map(
            ([label, value]) =>
                `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
        )
        .join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(record.prompt.slice(0, 160))}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:type" content="video.other">
  <meta property="og:video" content="${escapeHtml(record.video_url)}">
  <meta property="og:video:type" content="video/mp4">
  <style>
    :root { color-scheme: dark; background: #000; color: #fff; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #000; color: #fff; }
    main { width: min(960px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0 56px; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    .brand { color: rgba(255,255,255,.48); font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 0 0 18px; font-size: clamp(28px, 5vw, 56px); line-height: 1; font-weight: 650; letter-spacing: 0; }
    video { display: block; width: 100%; max-height: 72vh; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; background: #050505; }
    .panel { margin-top: 18px; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; background: rgba(255,255,255,.04); padding: 16px; }
    .label { margin: 0 0 8px; color: rgba(255,255,255,.52); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    textarea { width: 100%; min-height: 128px; resize: vertical; border: 1px solid rgba(255,255,255,.14); border-radius: 6px; background: rgba(0,0,0,.6); color: rgba(255,255,255,.86); padding: 12px; font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.10); text-align: left; vertical-align: top; }
    th { width: 32%; color: rgba(255,255,255,.52); font-weight: 500; }
    td { color: rgba(255,255,255,.86); }
    tr:last-child th, tr:last-child td { border-bottom: 0; }
    .cta { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin-top: 22px; border-radius: 6px; background: #fff; color: #000; padding: 0 18px; font-weight: 650; text-decoration: none; }
    .meta { margin-top: 12px; color: rgba(255,255,255,.42); font-size: 12px; }
    @media (max-width: 640px) { main { width: min(100% - 24px, 960px); padding-top: 24px; } .top { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <main>
    <div class="top">
      <div class="brand">Xcity Studio</div>
      <a class="cta" href="${escapeHtml(recreateUrl)}">Recreate in Xcity Studio</a>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <video controls playsinline preload="metadata" src="${escapeHtml(record.video_url)}"></video>
    <section class="panel" aria-labelledby="prompt-title">
      <p class="label" id="prompt-title">Prompt</p>
      <textarea readonly onclick="this.select()" aria-label="Prompt">${escapeHtml(record.prompt)}</textarea>
    </section>
    ${
        rows
            ? `<section class="panel" aria-labelledby="settings-title"><p class="label" id="settings-title">Settings</p><table><tbody>${rows}</tbody></table></section>`
            : ''
    }
    <a class="cta" href="${escapeHtml(recreateUrl)}">Recreate in Xcity Studio</a>
    <div class="meta">Shared ${escapeHtml(record.created_at || '')}</div>
  </main>
</body>
</html>`;
}

async function handleSharePage(env, id) {
    const record = await readShareRecord(env, id);
    if (!record) {
        return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response(renderShareHtml(record, env), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}

async function handleShareJson(env, id, cors) {
    const safeId = safeShareId(id);
    if (!safeId) {
        return json({ error: 'not found' }, 404, cors);
    }
    const object = await env.XCITY_MEDIA.get(shareKey(safeId));
    if (!object) {
        return json({ error: 'not found' }, 404, cors);
    }

    const headers = new Headers(cors);
    headers.set('Content-Type', 'application/json');
    headers.set('Cache-Control', 'no-store');
    return new Response(object.body, { status: 200, headers });
}

async function handleShareDelete(request, env, cors) {
    const { owner, error } = await authOwner(request, env, cors);
    if (error) return error;

    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ error: 'invalid JSON body' }, 400, cors);
    }

    const id = safeShareId(payload?.id);
    if (!id) {
        return json({ error: 'id is required' }, 400, cors);
    }

    const record = await readShareRecord(env, id);
    if (!record) {
        return json({ error: 'not found' }, 404, cors);
    }
    if (record.owner !== owner) {
        return json({ error: 'share is outside your namespace' }, 403, cors);
    }

    await env.XCITY_MEDIA.delete(shareKey(id));
    return json({ ok: true, id }, 200, cors);
}

const MAX_STATE_BYTES = 2 * 1024 * 1024;

function stateKey(owner) {
    return `${owner}/state/history.json`;
}

function etagFromIfMatch(value) {
    const trimmed = (value || '').trim();
    if (!trimmed || trimmed === '*') return null;
    return trimmed.replace(/^"|"$/g, '');
}

function isRecord(value) {
    return typeof value === 'object' && value !== null;
}

function normalizeStateDoc(value) {
    if (!isRecord(value)) {
        return { updatedAt: 0, history: [], characters: [], portraits: [], deletedIds: [] };
    }
    return {
        updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
        history: Array.isArray(value.history) ? value.history : [],
        characters: Array.isArray(value.characters) ? value.characters : [],
        portraits: Array.isArray(value.portraits) ? value.portraits : [],
        deletedIds: Array.isArray(value.deletedIds) ? value.deletedIds.filter((id) => typeof id === 'string') : []
    };
}

function historyRank(item) {
    const terminal = item?.status === 'completed' || item?.status === 'failed' ? 2 : 0;
    return terminal + (item?.storedUrl ? 1 : 0);
}

function mergeStateDocs(local, remote) {
    const a = normalizeStateDoc(local);
    const b = normalizeStateDoc(remote);
    const deletedIds = Array.from(new Set([...b.deletedIds, ...a.deletedIds])).slice(-500);
    const tombstoned = new Set(deletedIds);

    const byId = new Map();
    for (const item of [...b.history, ...a.history]) {
        if (!isRecord(item) || typeof item.id !== 'string' || tombstoned.has(item.id)) continue;
        const existing = byId.get(item.id);
        if (!existing || historyRank(item) >= historyRank(existing)) byId.set(item.id, item);
    }

    const characterById = new Map();
    for (const item of [...b.characters, ...a.characters]) {
        if (isRecord(item) && typeof item.id === 'string' && !tombstoned.has(item.id)) {
            characterById.set(item.id, item);
        }
    }

    const portraitByAssetId = new Map();
    for (const item of [...b.portraits, ...a.portraits]) {
        if (isRecord(item) && typeof item.assetId === 'string' && !tombstoned.has(item.assetId)) {
            portraitByAssetId.set(item.assetId, item);
        }
    }

    return {
        updatedAt: Math.max(a.updatedAt, b.updatedAt),
        history: Array.from(byId.values()).sort((x, y) => (y.timestamp || 0) - (x.timestamp || 0)),
        characters: Array.from(characterById.values()),
        portraits: Array.from(portraitByAssetId.values()),
        deletedIds
    };
}

async function putMergedState(env, key, incomingDoc) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = await env.XCITY_MEDIA.get(key);
        if (!current) {
            const stored = await env.XCITY_MEDIA.put(key, JSON.stringify(normalizeStateDoc(incomingDoc)), {
                onlyIf: { etagDoesNotExist: true },
                httpMetadata: {
                    contentType: 'application/json',
                    cacheControl: 'no-store'
                }
            });
            if (stored) return stored;
            continue;
        }

        const currentDoc = await current
            .json()
            .then((value) => normalizeStateDoc(value))
            .catch(() => normalizeStateDoc({}));
        const merged = mergeStateDocs(incomingDoc, currentDoc);
        const stored = await env.XCITY_MEDIA.put(key, JSON.stringify(merged), {
            onlyIf: { etagMatches: etagFromIfMatch(current.httpEtag || '') },
            httpMetadata: {
                contentType: 'application/json',
                cacheControl: 'no-store'
            }
        });
        if (stored) return stored;
    }

    return null;
}

async function handleStateGet(request, env, cors) {
    const { owner, error } = await authOwner(request, env, cors);
    if (error) return error;

    const object = await env.XCITY_MEDIA.get(stateKey(owner));
    if (!object) {
        return json({ error: 'no state' }, 404, cors);
    }

    const headers = new Headers(cors);
    headers.set('Content-Type', 'application/json');
    headers.set('Cache-Control', 'no-store');
    headers.set('ETag', object.httpEtag);
    return new Response(object.body, { status: 200, headers });
}

async function handleStatePut(request, env, cors) {
    const { owner, error } = await authOwner(request, env, cors);
    if (error) return error;

    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_STATE_BYTES) {
        return json({ error: 'state is over the 2 MB limit' }, 413, cors);
    }

    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_STATE_BYTES) {
        return json({ error: 'state is over the 2 MB limit' }, 413, cors);
    }

    const text = new TextDecoder().decode(body);
    let incomingDoc;
    try {
        incomingDoc = JSON.parse(text);
    } catch {
        return json({ error: 'invalid JSON body' }, 400, cors);
    }

    const key = stateKey(owner);
    const etagMatches = etagFromIfMatch(request.headers.get('if-match'));
    const onlyIf = etagMatches ? { etagMatches } : { etagDoesNotExist: true };
    let stored = await env.XCITY_MEDIA.put(key, JSON.stringify(normalizeStateDoc(incomingDoc)), {
        onlyIf,
        httpMetadata: {
            contentType: 'application/json',
            cacheControl: 'no-store'
        }
    });
    if (!stored) {
        stored = await putMergedState(env, key, incomingDoc);
    }
    if (!stored) {
        return json({ error: 'state changed on another device after merge retries' }, 412, cors);
    }

    return json({ etag: stored.httpEtag }, 200, cors);
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

    const videoId = await safeVideoId(payload?.video_id || '');
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
    // an open proxy that fetches arbitrary hosts on our behalf. Ark serves
    // output from volces.com (CN infra) and bytepluses.com/byteplus.com
    // (international) depending on model/pipeline.
    if (
        source.protocol !== 'https:' ||
        !/(^|\.)(volces\.com|bytepluses\.com|byteplus\.com)$/.test(source.hostname)
    ) {
        return json({ error: `source_url host is not allowed (${source.hostname})` }, 400, cors);
    }

    const owner = await resolveOwner(bearer, env);
    if (!owner) {
        return json({ error: 'invalid or unauthorized key' }, 403, cors);
    }

    const key = archivedVideoKey(owner, videoId);

    const existing = await env.XCITY_MEDIA.head(key);
    if (existing) {
        return json(archivedVideoPayload(request, key, existing, true), 200, cors);
    }

    const upstream = await fetch(source.toString(), {
        headers: providerVideoHeaders()
    });
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
        archivedVideoPayload(request, key, { size: stored?.size ?? declared ?? null }, false),
        200,
        cors
    );
}

async function handleArchiveLookup(request, env, cors, rawVideoId) {
    const { owner, error } = await authOwner(request, env, cors);
    if (error) return error;

    const videoId = await safeVideoId(rawVideoId || '');
    if (!videoId) {
        return json({ error: 'video id is required' }, 400, cors);
    }

    for (const ext of ['mp4', 'webm', 'mov']) {
        const key = archivedVideoKey(owner, videoId, ext);
        const existing = await env.XCITY_MEDIA.head(key);
        if (existing) {
            return json(archivedVideoPayload(request, key, existing, true), 200, cors);
        }
    }

    return json({ error: 'archive not found' }, 404, cors);
}

async function handleArchiveUpload(request, env, cors, rawVideoId) {
    const auth = request.headers.get('authorization') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!bearer) {
        return json({ error: 'missing bearer token' }, 401, cors);
    }

    const owner = await resolveOwner(bearer, env);
    if (!owner) {
        return json({ error: 'invalid or unauthorized key' }, 403, cors);
    }

    const videoId = await safeVideoId(rawVideoId || '');
    if (!videoId) {
        return json({ error: 'video id is required' }, 400, cors);
    }

    const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
    const ext = UPLOAD_TYPES[contentType];
    if (!ext || !contentType.startsWith('video/')) {
        return json({ error: 'unsupported content-type (want video/mp4, video/quicktime, or video/webm)' }, 415, cors);
    }

    const body = await request.arrayBuffer();
    const maxBytes = Number(env.MAX_BYTES || 0) || 209715200;
    if (body.byteLength === 0) {
        return json({ error: 'empty body' }, 400, cors);
    }
    if (body.byteLength > maxBytes) {
        return json({ error: `video is ${body.byteLength} bytes, over the ${maxBytes} limit` }, 413, cors);
    }

    const key = archivedVideoKey(owner, videoId, ext);
    const existing = await env.XCITY_MEDIA.head(key);
    if (existing) {
        return json(archivedVideoPayload(request, key, existing, true), 200, cors);
    }

    const name = assetNameFromHeader(request);
    const stored = await env.XCITY_MEDIA.put(key, body, {
        httpMetadata: {
            contentType,
            cacheControl: 'public, max-age=31536000, immutable'
        },
        ...(name ? { customMetadata: { name } } : {})
    });

    return json(archivedVideoPayload(request, key, { size: stored?.size ?? body.byteLength }, false), 200, cors);
}

async function handleMedia(request, env, key, cors) {
    const notFoundHeaders = { ...cors, 'Cache-Control': 'no-store' };
    if (!key) return new Response('Not Found', { status: 404, headers: notFoundHeaders });
    if (key.startsWith('share/')) {
        return new Response('Not Found', { status: 404, headers: notFoundHeaders });
    }
    if (key.startsWith('community/')) {
        return new Response('Not Found', { status: 404, headers: notFoundHeaders });
    }
    if (/^(u|k)\/[^/]+\/state\//.test(key)) {
        return new Response('Not Found', { status: 404, headers: notFoundHeaders });
    }

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

        const archiveMediaMatch = url.pathname.match(/^\/archive\/(.+)$/);
        if (archiveMediaMatch && request.method === 'GET') {
            return handleArchiveLookup(request, env, cors, decodeURIComponent(archiveMediaMatch[1]));
        }

        if (archiveMediaMatch && request.method === 'POST') {
            return handleArchiveUpload(request, env, cors, decodeURIComponent(archiveMediaMatch[1]));
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

        if (url.pathname === '/share' && request.method === 'POST') {
            return handleShareCreate(request, env, cors);
        }

        if (url.pathname === '/share/delete' && request.method === 'POST') {
            return handleShareDelete(request, env, cors);
        }

        if (url.pathname === '/community/publish' && request.method === 'POST') {
            return handleCommunityPublish(request, env, cors);
        }

        if (url.pathname === '/community/queue' && request.method === 'GET') {
            return handleCommunityQueue(request, env, cors);
        }

        if (url.pathname === '/community/review' && request.method === 'POST') {
            return handleCommunityReview(request, env, cors);
        }

        if (url.pathname === '/community/list' && request.method === 'GET') {
            return handleCommunityList(env, cors);
        }

        if (url.pathname === '/state' && request.method === 'GET') {
            return handleStateGet(request, env, cors);
        }

        if (url.pathname === '/state' && request.method === 'PUT') {
            return handleStatePut(request, env, cors);
        }

        const shareJsonMatch = url.pathname.match(/^\/share\/([0-9a-z]{8})\.json$/);
        if (shareJsonMatch && request.method === 'GET') {
            return handleShareJson(env, shareJsonMatch[1], cors);
        }

        const sharePageMatch = url.pathname.match(/^\/share\/([0-9a-z]{8})$/);
        if (sharePageMatch && request.method === 'GET') {
            return handleSharePage(env, sharePageMatch[1]);
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
