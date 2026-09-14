import { requirePortraitRoute } from '@/server/portrait/guards';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('portrait route guard', () => {
    it('rejects provider asset routes without bearer auth', async () => {
        const gate = requirePortraitRoute(new Request('https://studio.example/api/portrait/assets'));

        expect('response' in gate ? gate.response.status : 200).toBe(401);
        expect('response' in gate ? await gate.response.json() : {}).toEqual({
            error: 'missing bearer token'
        });
    });

    it('accepts bearer auth for provider asset routes', () => {
        const gate = requirePortraitRoute(
            new Request('https://studio.example/api/portrait/assets', {
                headers: { Authorization: 'Bearer key-fixture' }
            })
        );

        expect('auth' in gate ? gate.auth.bearer : '').toBe('key-fixture');
    });
});
