import { jsonError, requirePortraitRoute } from '@/server/portrait/guards';
import { providerAssetResponse } from '@/server/providers/xcity/provider-assets';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const body = await request.text();
    if (!body) return jsonError('missing request body', 400);
    return providerAssetResponse('', gate.auth.bearer, { method: 'POST', body });
}

export async function GET(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const id = new URL(request.url).searchParams.get('id')?.trim() ?? '';
    if (!id) return jsonError('missing id', 400);
    return providerAssetResponse(`/${encodeURIComponent(id)}`, gate.auth.bearer);
}
