import { jsonError, requirePortraitRoute } from '@/server/portrait/guards';
import { assetDeletionProtection } from '@/server/assets/protection';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const protection = await assetDeletionProtection(gate.auth.bearer);
    if (protection === 'unavailable') return jsonError('ASSET_IDENTITY_UNAVAILABLE', 503);
    return Response.json({ deletionProtected: protection === 'protected' }, {
        headers: { 'Cache-Control': 'no-store' }
    });
}
