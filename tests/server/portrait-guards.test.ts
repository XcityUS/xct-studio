import { requirePortraitRoute } from '@/server/portrait/guards';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

afterEach(() => vi.unstubAllEnvs());

describe('portrait route guard', () => {
    it('rejects provider asset routes when the capability is disabled', async () => {
        vi.stubEnv('PROVIDER_ASSETS_ENABLED', '');

        const gate = requirePortraitRoute(
            new Request('https://studio.example/api/portrait/assets', {
                headers: { Authorization: 'Bearer key-fixture' }
            })
        );

        expect('response' in gate ? gate.response.status : 200).toBe(503);
        expect('response' in gate ? await gate.response.json() : {}).toEqual({
            error: 'provider asset review is not configured'
        });
    });

    it('accepts bearer auth when provider assets are enabled', () => {
        vi.stubEnv('PROVIDER_ASSETS_ENABLED', 'true');

        const gate = requirePortraitRoute(
            new Request('https://studio.example/api/portrait/assets', {
                headers: { Authorization: 'Bearer key-fixture' }
            })
        );

        expect('auth' in gate ? gate.auth.bearer : '').toBe('key-fixture');
    });
});
