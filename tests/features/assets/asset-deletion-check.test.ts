import { checkAssetDeletionProtection } from '@/features/assets/protection/check';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe('asset deletion permission check', () => {
    it('reports protected accounts from the authenticated Studio route', async () => {
        const fetcher = vi.fn(async () => Response.json({ deletionProtected: true }));
        vi.stubGlobal('fetch', fetcher);

        await expect(checkAssetDeletionProtection(async () => 'fixture-key')).resolves.toBe(true);
        expect(fetcher).toHaveBeenCalledWith('/api/assets/protection', {
            headers: { Authorization: 'Bearer fixture-key' },
            cache: 'no-store'
        });
    });

    it('does not treat failed or malformed checks as permission to delete', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'unavailable' }, { status: 503 })));
        await expect(checkAssetDeletionProtection(async () => 'fixture-key')).rejects.toThrow();
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({})));
        await expect(checkAssetDeletionProtection(async () => 'fixture-key')).rejects.toThrow();
    });
});
