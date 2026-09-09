import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { providerAssetResponse } from '@/server/providers/xcity/provider-assets';

describe('providerAssetResponse', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('retries transient failures for read requests', async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'temporary failure' }), { status: 502 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ assets: [{ assetId: 'asset-1' }] }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await providerAssetResponse('?type=all', 'test-key');

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ assets: [{ assetId: 'asset-1' }] });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry write requests', async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ detail: 'temporary failure' }), { status: 502 }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await providerAssetResponse('/groups', 'test-key', {
            method: 'POST',
            body: JSON.stringify({ name: 'character' })
        });

        expect(response.status).toBe(502);
        await expect(response.json()).resolves.toEqual({ error: 'temporary failure' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
