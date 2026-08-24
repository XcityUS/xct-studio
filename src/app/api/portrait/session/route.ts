import { arkOpenApi } from '@/lib/server/byteplus-openapi';
import {
    jsonError,
    readJsonRecord,
    requirePortraitRoute,
    responseJson,
    resultRoot,
    stringField
} from '@/lib/server/portrait-routes';

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

    try {
        const payload = await arkOpenApi('CreateVisualValidateSession', {
            CallbackURL: `${origin}/portrait-callback`
        });
        const root = resultRoot(payload);
        const h5Link = stringField(root, 'H5Link', 'h5Link');
        const bytedToken = stringField(root, 'BytedToken', 'bytedToken');
        if (!h5Link || !bytedToken) {
            return jsonError(`portrait session returned an unexpected payload: ${JSON.stringify(payload)}`, 502);
        }
        return responseJson({ h5Link: h5LinkWithEnglish(h5Link), bytedToken });
    } catch (err) {
        return jsonError(err instanceof Error ? err.message : 'portrait session failed', 502);
    }
}
