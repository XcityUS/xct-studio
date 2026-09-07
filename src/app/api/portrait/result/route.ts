import { jsonError, requirePortraitRoute } from '@/server/portrait/guards';
import { providerAssetResponse } from '@/server/providers/xcity/provider-assets';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const body = await request.text();
    if (!body) return jsonError('missing request body', 400);
    return providerAssetResponse('/verification-results', gate.auth.bearer, { method: 'POST', body });
}
