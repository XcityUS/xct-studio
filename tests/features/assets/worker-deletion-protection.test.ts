// The deployed media Worker is still JavaScript; its TypeScript migration is separate work.
// @ts-expect-error Legacy Worker has no TypeScript declaration.
import worker from '../../../media-worker/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function bucket() {
    return { delete: vi.fn(async () => undefined) };
}

function request(key: string): Request {
    return new Request('https://media.example/assets/delete', {
        method: 'POST',
        headers: { Authorization: 'Bearer fixture-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
    });
}

describe('media Worker asset deletion protection', () => {
    it('refuses deletion in the protected account namespace', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ info: { user_id: 'd5f4d864-e07e-45c4-957f-795a724ac750' } })));
        const storage = bucket();
        const response = await worker.fetch(request('u/d5f4d864-e07e-45c4-957f-795a724ac750/images/photo.png'), {
            XCITY_MEDIA: storage,
            LITELLM_BASE_URL: 'https://gateway.example'
        });

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: 'ASSET_DELETE_PROTECTED' });
        expect(storage.delete).not.toHaveBeenCalled();
    });

    it('preserves ordinary owner-scoped deletion', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ info: { user_id: 'other-id' } })));
        const storage = bucket();
        const response = await worker.fetch(request('u/other-id/images/photo.png'), {
            XCITY_MEDIA: storage,
            LITELLM_BASE_URL: 'https://gateway.example',
            PROTECTED_ASSET_USER_IDS: 'demo-id'
        });

        expect(response.status).toBe(200);
        expect(storage.delete).toHaveBeenCalledWith('u/other-id/images/photo.png');
    });
});
