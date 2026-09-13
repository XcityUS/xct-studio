import { providerAssetResponse } from '@/server/providers/xcity/provider-assets';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const fetchMock = vi.fn();

describe('provider library request coordination', () => {
    beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('shares concurrent reads without consuming another caller response', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ groups: [] }), { status: 200 }));
        const [a, b] = await Promise.all([
            providerAssetResponse('/groups?type=all', 'concurrent-fixture'),
            providerAssetResponse('/groups?type=all', 'concurrent-fixture')
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(await a.json()).toEqual({ groups: [] });
        expect(await b.json()).toEqual({ groups: [] });
    });

    it('honors cooldown across paths, and keeps credentials isolated', async () => {
        vi.useFakeTimers();
        fetchMock.mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '90' } }));
        const first = await providerAssetResponse('/groups', 'limited-fixture');
        expect(first.status).toBe(429);
        expect(first.headers.get('Retry-After')).toBe('90');
        const second = await providerAssetResponse('?type=all', 'limited-fixture');
        expect(second.status).toBe(429);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fetchMock.mockResolvedValue(new Response('{"assets":[]}', { status: 200 }));
        expect((await providerAssetResponse('?type=all', 'other-fixture')).status).toBe(200);
        await vi.advanceTimersByTimeAsync(90001);
        expect((await providerAssetResponse('?type=all', 'limited-fixture')).status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('never retries mutations and invalidates cached reads on success', async () => {
        fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
        await providerAssetResponse('/groups', 'mutation-fixture');
        await providerAssetResponse('/groups', 'mutation-fixture', { method: 'POST', body: '{}' });
        await providerAssetResponse('/groups', 'mutation-fixture');
        expect(fetchMock).toHaveBeenCalledTimes(3);
        fetchMock.mockResolvedValue(new Response('{}', { status: 429 }));
        expect((await providerAssetResponse('/groups', 'mutation-fixture', { method: 'POST' })).status).toBe(429);
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});
