import { arkOpenApi, byteplusPortraitConfigured } from '@/lib/server/byteplus-openapi';
import { requirePortraitRoute, responseJson } from '@/lib/server/portrait-routes';

export const dynamic = 'force-dynamic';

/**
 * Self-test for the private real-human asset library.
 *
 * "Not enabled" used to be indistinguishable from "credentials rejected" or
 * "account lacks the invited-user entitlement" — all three just hid the UI.
 * This probes ListAssetGroups with the configured account keys and hands back
 * whatever BytePlus says, so an operator can tell those cases apart. Never
 * returns the keys themselves.
 */
export async function GET(request: Request) {
    const gate = await requirePortraitRoute(request, { allowUnconfigured: true });
    if ('response' in gate) return gate.response;

    if (!byteplusPortraitConfigured()) {
        return responseJson({
            configured: false,
            ok: false,
            projectName: (process.env.ARK_PROJECT_NAME || 'default').trim(),
            error: 'BYTEPLUS_AK / BYTEPLUS_SK are not set on this deployment.'
        });
    }

    try {
        await arkOpenApi('ListAssetGroups', { PageNumber: 1, PageSize: 1 });
        return responseJson({
            configured: true,
            ok: true,
            projectName: (process.env.ARK_PROJECT_NAME || 'default').trim()
        });
    } catch (err) {
        return responseJson({
            configured: true,
            ok: false,
            projectName: (process.env.ARK_PROJECT_NAME || 'default').trim(),
            error: err instanceof Error ? err.message : 'ListAssetGroups failed'
        });
    }
}
