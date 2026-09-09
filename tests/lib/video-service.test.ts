import { buildCreateBody } from '@/lib/video-service';
import { DEFAULT_RATIO, DEFAULT_RESOLUTION, DEFAULT_VIDEO_REFERENCE_MODEL } from '@/shared/config/seedance';
import type { VideoJobCreate } from '@/shared/contracts/video';
import { describe, expect, it } from 'vitest';

function createParams(referenceVideoUrl: string): VideoJobCreate {
    return {
        model: DEFAULT_VIDEO_REFERENCE_MODEL,
        prompt: 'Use the motion from [Video 1].',
        ratio: DEFAULT_RATIO,
        resolution: DEFAULT_RESOLUTION,
        seconds: 5,
        generate_audio: true,
        reference_video_urls: [referenceVideoUrl]
    };
}

describe('Seedance create request', () => {
    it('submits approved videos by Asset ID and enables the asset API', () => {
        const body = buildCreateBody(createParams('asset://asset-123'));

        expect(body.input_reference).toEqual([{ url: 'asset://asset-123', role: 'reference_video' }]);
        expect(body.extra_body).toMatchObject({ seedance_use_asset_api: true });
    });

    it('does not enable the asset API for ordinary public URLs', () => {
        const body = buildCreateBody(createParams('https://media.xcity.ai/download/reference.mp4'));

        expect(body.extra_body).not.toHaveProperty('seedance_use_asset_api');
    });
});
