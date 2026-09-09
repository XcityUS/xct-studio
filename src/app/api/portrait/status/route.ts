import { requirePortraitRoute } from '@/server/portrait/guards';
import { providerAssetResponse } from '@/server/providers/xcity/provider-assets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;
    return providerAssetResponse('/status', gate.auth.bearer);
}
