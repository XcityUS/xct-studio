import {
    captionedFilename,
    createCaptionedVideo
} from '@/features/generation/components/VideoOutput/CaptionDownloads/download';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { burnCaptionsIntoVideo } = vi.hoisted(() => ({ burnCaptionsIntoVideo: vi.fn() }));

vi.mock('@/features/post-production/assembly/client', () => ({ burnCaptionsIntoVideo }));

describe('captioned video download', () => {
    beforeEach(() => {
        burnCaptionsIntoVideo.mockReset();
        vi.unstubAllGlobals();
    });

    it('burns the SRT into the current video blob without requesting generation', async () => {
        const source = new Blob(['source'], { type: 'video/mp4' });
        const output = new Blob(['captioned'], { type: 'video/mp4' });
        const progress = vi.fn();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(source, { status: 200 })));
        burnCaptionsIntoVideo.mockResolvedValue(output);

        await expect(
            createCaptionedVideo('/current.mp4', '1\n00:00:00,000 --> 00:00:01,000\nHello!', progress)
        ).resolves.toBe(output);
        expect(fetch).toHaveBeenCalledWith('/current.mp4');
        expect(burnCaptionsIntoVideo).toHaveBeenCalledWith(
            source,
            expect.objectContaining({ srt: expect.stringContaining('Hello!') }),
            progress
        );
    });

    it('uses a distinct MP4 filename without changing the original filename', () => {
        expect(captionedFilename('family.mp4', 'job-1')).toBe('family-subtitled.mp4');
        expect(captionedFilename(undefined, 'job-1')).toBe('job-1-subtitled.mp4');
    });
});
