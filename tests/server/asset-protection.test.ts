import { GET } from '@/app/api/assets/protection/route';
import { DELETE } from '@/app/api/portrait/groups/route';
import { assetDeletionProtection, isProtectedAssetSubject, isProtectedAssetUserId } from '@/server/assets/protection';
import { afterEach, describe, expect, it, vi } from 'vitest';

const providerAssetResponse = vi.hoisted(() => vi.fn(async () => Response.json({ ok: true })));
vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/xcity/provider-assets', () => ({ providerAssetResponse }));

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    providerAssetResponse.mockClear();
});

function deleteGroupRequest(): Request {
    return new Request('https://studio.example/api/portrait/groups?id=group-1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer fixture-key' }
    });
}

describe('asset deletion protection', () => {
    it('protects the verified demo account even without an environment override', () => {
        expect(isProtectedAssetUserId('d5f4d864-e07e-45c4-957f-795a724ac750')).toBe(true);
        expect(isProtectedAssetUserId('someone-else')).toBe(false);
    });

    it('matches only configured stable user IDs', () => {
        vi.stubEnv('PROTECTED_ASSET_USER_IDS', 'demo-id, other-id');
        expect(isProtectedAssetSubject('xcity:demo-id')).toBe(true);
        expect(isProtectedAssetSubject('xcity:someone-else')).toBe(false);
        expect(isProtectedAssetSubject('demo@xcity.ai')).toBe(false);
    });

    it('blocks a protected account before provider group deletion', async () => {
        vi.stubEnv('PROTECTED_ASSET_USER_IDS', 'demo-id');
        const fetcher = vi.fn(async () => Response.json({ info: { user_id: 'demo-id' } }));
        vi.stubGlobal('fetch', fetcher);

        expect(await assetDeletionProtection('fixture-key')).toBe('protected');
        const response = await DELETE(deleteGroupRequest());
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: 'ASSET_DELETE_PROTECTED' });
        expect(providerAssetResponse).not.toHaveBeenCalled();
        expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/key/info'), expect.any(Object));
        const status = await GET(deleteGroupRequest());
        expect(await status.json()).toEqual({ deletionProtected: true });
    });

    it('allows other accounts and fails closed when identity lookup fails', async () => {
        vi.stubEnv('PROTECTED_ASSET_USER_IDS', 'demo-id');
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ info: { user_id: 'other-id' } })));
        expect((await DELETE(deleteGroupRequest())).status).toBe(200);
        expect(providerAssetResponse).toHaveBeenCalledOnce();

        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })));
        const unavailable = await DELETE(deleteGroupRequest());
        expect(unavailable.status).toBe(503);
        expect(providerAssetResponse).toHaveBeenCalledOnce();
    });
});
