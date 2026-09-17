import { hostedShareVideoUrl, HostedShareMediaError } from '@/features/studio/components/StudioWorkspace/share-media';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe('hosted share video URL', () => {
    it('rebases an archived video from an old Worker domain to the current host', async () => {
        const fetchMedia = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMedia);

        const url = await hostedShareVideoUrl(
            'https://old-media.example/media/u/person-1/videos/clip.mp4',
            'https://media.xcity.ai'
        );

        expect(url).toBe('https://media.xcity.ai/media/u/person-1/videos/clip.mp4');
        expect(fetchMedia).toHaveBeenCalledWith(url, { method: 'HEAD', redirect: 'error' });
    });

    it('keeps the same media path on the current host', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
        expect(
            await hostedShareVideoUrl('https://media.xcity.ai/media/k/hash-1/clip.webm', 'https://media.xcity.ai')
        ).toBe('https://media.xcity.ai/media/k/hash-1/clip.webm');
        expect(
            await hostedShareVideoUrl(
                'https://old-media.example/media/u/person%40xcity.ai/clip.mp4',
                'https://media.xcity.ai'
            )
        ).toBe('https://media.xcity.ai/media/u/person@xcity.ai/clip.mp4');
    });

    it('does not share a missing object or a provider-only URL', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        await expect(
            hostedShareVideoUrl('https://old-media.example/media/u/person-1/clip.mp4', 'https://media.xcity.ai')
        ).rejects.toEqual(new HostedShareMediaError('unavailable'));
        await expect(
            hostedShareVideoUrl('https://provider.example/clip.mp4', 'https://media.xcity.ai')
        ).rejects.toEqual(new HostedShareMediaError('not-archived'));
    });
});
