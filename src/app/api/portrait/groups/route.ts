import { jsonError, requirePortraitRoute } from '@/server/portrait/guards';
import { assetDeletionProtection } from '@/server/assets/protection';
import { providerAssetResponse } from '@/server/providers/xcity/provider-assets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const type = new URL(request.url).searchParams.get('type')?.trim() || 'liveness';
    if (!['liveness', 'aigc', 'all'].includes(type)) return jsonError('invalid group type', 400);
    return providerAssetResponse(`/groups?type=${encodeURIComponent(type)}`, gate.auth.bearer);
}

export async function POST(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const body = await request.text();
    if (!body) return jsonError('missing request body', 400);
    return providerAssetResponse('/groups', gate.auth.bearer, { method: 'POST', body });
}

export async function DELETE(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const protection = await assetDeletionProtection(gate.auth.bearer);
    if (protection === 'protected') return jsonError('ASSET_DELETE_PROTECTED', 403);
    if (protection === 'unavailable') return jsonError('ASSET_IDENTITY_UNAVAILABLE', 503);

    const groupId = new URL(request.url).searchParams.get('id')?.trim();
    if (!groupId) return jsonError('missing group id', 400);
    return providerAssetResponse(`/groups/${encodeURIComponent(groupId)}`, gate.auth.bearer, { method: 'DELETE' });
}
