import { jsonError, readJsonRecord, requirePortraitRoute } from '@/server/portrait/guards';
import { providerAssetResponse } from '@/server/providers/xcity/provider-assets';

export const dynamic = 'force-dynamic';

function normalizeOrigin(value: string): string {
    try {
        return new URL(value).origin;
    } catch {
        return '';
    }
}

/**
 * The H5 page defaults to Chinese; `lng` picks the language.
 *
 * Appended textually on purpose: the link carries a long signed `pl` token,
 * and round-tripping it through URL/URLSearchParams re-encodes the whole
 * query string. Not worth risking a signature over a query parameter.
 */
function h5LinkWithEnglish(value: string): string {
    if (/[?&]lng=/.test(value)) return value;
    const [base, hash = ''] = value.split('#');
    return `${base}${base.includes('?') ? '&' : '?'}lng=en${hash ? `#${hash}` : ''}`;
}

export async function POST(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const body = await readJsonRecord(request);
    const origin = typeof body?.origin === 'string' ? normalizeOrigin(body.origin) : '';
    const requestOrigin = normalizeOrigin(request.headers.get('origin') || '');
    if (!origin || !requestOrigin || origin !== requestOrigin) {
        return jsonError('invalid origin', 400);
    }

    const response = await providerAssetResponse('/verification-sessions', gate.auth.bearer, {
        method: 'POST',
        body: JSON.stringify({ callbackUrl: `${origin}/portrait-callback` })
    });
    if (!response.ok) return response;

    const payload = (await response.json()) as { h5Link?: unknown; bytedToken?: unknown };
    if (typeof payload.h5Link !== 'string' || typeof payload.bytedToken !== 'string') {
        return jsonError('portrait session returned an unexpected payload', 502);
    }
    return Response.json({ h5Link: h5LinkWithEnglish(payload.h5Link), bytedToken: payload.bytedToken });
}
