import { jsonError, requirePortraitRoute } from '@/server/portrait/guards';
import { providerAssetResponse } from '@/server/providers/xcity/provider-assets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const type = new URL(request.url).searchParams.get('type')?.trim() || 'all';
    if (!['liveness', 'aigc', 'all'].includes(type)) return jsonError('invalid asset type', 400);
    return providerAssetResponse(`?type=${encodeURIComponent(type)}`, gate.auth.bearer);
}
