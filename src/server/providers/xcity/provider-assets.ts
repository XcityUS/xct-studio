import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import 'server-only';

const RETRYABLE_READ_STATUSES = new Set([502, 503, 504]);
const READ_RETRY_DELAYS_MS = [500, 1500] as const;
const READ_CACHE_TTL_MS = 60_000;
const STALE_READ_CACHE_TTL_MS = 5 * 60_000;

type ReadCacheEntry = {
    body: unknown;
    createdAt: number;
};

const state = globalThis as typeof globalThis & {
    studioAssetReads?: {
        cache: Map<string, ReadCacheEntry>;
        pending: Map<string, Promise<NextResponse>>;
        cooldown: Map<string, number>;
    };
};
const reads = state.studioAssetReads ??= { cache: new Map(), pending: new Map(), cooldown: new Map() };
const readCache = reads.cache;

function gatewayV1BaseUrl(): string {
    const configured = (
        process.env.XCITY_LITELLM_URL ||
        process.env.TOKENHUB_URL ||
        process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL ||
        'https://tokenhub.xcity.one'
    )
        .trim()
        .replace(/\/+$/, '');
    return configured.endsWith('/v1') ? configured : `${configured}/v1`;
}

function validationMessage(value: unknown): string {
    if (!Array.isArray(value)) return '';
    return value
        .flatMap((item) => {
            if (!item || typeof item !== 'object') return [];
            const record = item as Record<string, unknown>;
            if (typeof record.msg !== 'string') return [];
            const location = Array.isArray(record.loc)
                ? record.loc
                      .filter((part) => part !== 'body')
                      .map(String)
                      .join('.')
                : '';
            return [location ? `${location}: ${record.msg}` : record.msg];
        })
        .join('; ');
}

function errorMessage(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const record = value as Record<string, unknown>;
    if (typeof record.error === 'string') return record.error;
    if (typeof record.detail === 'string') return record.detail;
    return validationMessage(record.detail);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function readCacheKey(path: string, bearer: string): string {
    const subject = createHash('sha256').update(`${gatewayV1BaseUrl()}:${bearer}`).digest('hex');
    return `${subject}:${path}`;
}

function cachedRead(path: string, bearer: string, ttlMs: number): unknown | null {
    const cached = readCache.get(readCacheKey(path, bearer));
    return cached && Date.now() - cached.createdAt <= ttlMs ? cached.body : null;
}

function cacheRead(path: string, bearer: string, body: unknown) {
    if (readCache.size >= 500) readCache.delete(readCache.keys().next().value!);
    readCache.set(readCacheKey(path, bearer), { body, createdAt: Date.now() });
}

function providerErrorMessage(status: number, body: unknown): string {
    const message = errorMessage(body);
    if (message) return message;
    if (status === 429) return 'Provider asset service is rate-limited. Please wait a minute, then refresh.';
    if (status === 401 || status === 403) return 'Provider asset authentication failed. Check your Xcity API key.';
    return `Provider asset request failed (${status}).`;
}

async function fetchProviderAsset(
    url: string,
    init: RequestInit,
    retryDelays: readonly number[]
): Promise<{ response: Response; body: unknown }> {
    for (let attempt = 0; ; attempt += 1) {
        try {
            const response = await fetch(url, init);
            const body = (await response.json().catch(() => ({}))) as unknown;
            if (!RETRYABLE_READ_STATUSES.has(response.status) || attempt >= retryDelays.length) {
                return { response, body };
            }
        } catch (error) {
            if (attempt >= retryDelays.length) throw error;
        }
        await sleep(retryDelays[attempt]);
    }
}

export async function providerAssetResponse(
    path: string,
    bearer: string,
    init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}
): Promise<NextResponse> {
    const method = (init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
        const response = await requestAsset(path, bearer, init);
        if (response.ok) {
            const prefix = readCacheKey('', bearer);
            for (const key of readCache.keys()) if (key.startsWith(prefix)) readCache.delete(key);
        }
        return response;
    }
    const key = readCacheKey(path, bearer);
    const current = reads.pending.get(key);
    if (current) return (await current).clone() as NextResponse;
    const request = requestAsset(path, bearer, init);
    reads.pending.set(key, request);
    try {
        return (await request).clone() as NextResponse;
    } finally {
        if (reads.pending.get(key) === request) reads.pending.delete(key);
    }
}

function rateLimited(path: string, bearer: string, until: number): NextResponse {
    const retryAfter = Math.max(1, Math.ceil((until - Date.now()) / 1000));
    const stale = cachedRead(path, bearer, STALE_READ_CACHE_TTL_MS);
    return stale ? NextResponse.json(stale, {
        headers: { 'X-Xcity-Cache': 'stale', 'X-Xcity-Upstream-Status': '429', 'Retry-After': String(retryAfter) }
    }) : NextResponse.json({ error: 'PROVIDER_RATE_LIMITED', retryAfter }, {
        status: 429, headers: { 'Retry-After': String(retryAfter) }
    });
}

async function requestAsset(
    path: string,
    bearer: string,
    init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }
): Promise<NextResponse> {
    try {
        const requestInit: RequestInit = {
            ...init,
            headers: {
                Authorization: `Bearer ${bearer}`,
                ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                ...init.headers
            },
            cache: 'no-store',
            signal: init.signal ?? AbortSignal.timeout(20000)
        };
        const method = (requestInit.method ?? 'GET').toUpperCase();
        const canUseReadCache = method === 'GET' || method === 'HEAD';
        const freshCached = canUseReadCache ? cachedRead(path, bearer, READ_CACHE_TTL_MS) : null;
        if (freshCached) {
            return NextResponse.json(freshCached, { status: 200, headers: { 'X-Xcity-Cache': 'hit' } });
        }
        const subject = readCacheKey('', bearer);
        const until = reads.cooldown.get(subject) ?? 0;
        if (canUseReadCache && until > Date.now()) return rateLimited(path, bearer, until);
        if (until) reads.cooldown.delete(subject);
        const { response, body } = await fetchProviderAsset(
            `${gatewayV1BaseUrl()}/provider-assets${path}`,
            requestInit,
            canUseReadCache ? READ_RETRY_DELAYS_MS : []
        );
        if (!response.ok) {
            if (response.status === 429 && canUseReadCache) {
                const retry = response.headers.get('Retry-After');
                const seconds = retry && /^\d+(?:\.\d+)?$/.test(retry) ? Number(retry)
                    : retry ? (Date.parse(retry) - Date.now()) / 1000 : 60;
                const next = Date.now() + (Number.isFinite(seconds) ? Math.max(1, seconds) : 60) * 1000;
                if (reads.cooldown.size >= 500) reads.cooldown.delete(reads.cooldown.keys().next().value!);
                reads.cooldown.set(subject, next);
                return rateLimited(path, bearer, next);
            }
            const staleCached = response.status === 429 && canUseReadCache
                ? cachedRead(path, bearer, STALE_READ_CACHE_TTL_MS)
                : null;
            if (staleCached) {
                return NextResponse.json(staleCached, {
                    status: 200,
                    headers: { 'X-Xcity-Cache': 'stale', 'X-Xcity-Upstream-Status': String(response.status) }
                });
            }
            return NextResponse.json(
                { error: providerErrorMessage(response.status, body) },
                { status: response.status }
            );
        }
        if (canUseReadCache) {
            cacheRead(path, bearer, body);
        }
        return NextResponse.json(body, { status: response.status });
    } catch {
        return NextResponse.json(
            { error: 'Provider asset gateway is unavailable.' },
            { status: 502 }
        );
    }
}
