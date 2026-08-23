import { arkOpenApi, byteplusPortraitConfigured } from '@/lib/server/byteplus-openapi';
import { requirePortraitRoute, responseJson } from '@/lib/server/portrait-routes';

export const dynamic = 'force-dynamic';

type AssetGroupType = 'LivenessFace' | 'AIGC';

function projectName(): string {
    return (process.env.ARK_PROJECT_NAME || 'default').trim() || 'default';
}

async function probeGroupType(groupType: AssetGroupType): Promise<{ ok: boolean; error?: string }> {
    try {
        await arkOpenApi('ListAssetGroups', {
            Filter: { GroupType: groupType },
            PageNumber: 1,
            PageSize: 1
        });
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'ListAssetGroups failed' };
    }
}

/**
 * Self-test for the private portrait asset libraries.
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
            livenessOk: false,
            aigcOk: false,
            projectName: projectName(),
            error: 'BYTEPLUS_AK / BYTEPLUS_SK are not set on this deployment.'
        });
    }

    const [liveness, aigc] = await Promise.all([probeGroupType('LivenessFace'), probeGroupType('AIGC')]);
    const errors = [
        liveness.ok ? '' : `LivenessFace: ${liveness.error ?? 'failed'}`,
        aigc.ok ? '' : `AIGC: ${aigc.error ?? 'failed'}`
    ].filter(Boolean);

    return responseJson({
        configured: true,
        ok: liveness.ok && aigc.ok,
        livenessOk: liveness.ok,
        aigcOk: aigc.ok,
        projectName: projectName(),
        ...(errors.length ? { error: errors.join('; ') } : {})
    });
}
