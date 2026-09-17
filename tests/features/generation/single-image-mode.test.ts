import { canUseReferenceAudio } from '@/features/generation/components/CreationForm/reference-audio';
import { createSubmissionBuilder } from '@/features/generation/components/CreationForm/submission';
import { buildCreateBody } from '@/lib/video-service';
import { DEFAULT_MODEL, DEFAULT_VIDEO_REFERENCE_MODEL } from '@/shared/config/seedance';
import { describe, expect, it } from 'vitest';

function buildSubmission(
    model = DEFAULT_VIDEO_REFERENCE_MODEL,
    mode: 'reference' | 'first-frame' = 'reference',
    audioUrl = '',
    referenceUrls = ['asset://portrait-1'],
    referenceAudioRange?: { startSeconds: number; endSeconds: number }
) {
    const referenceCap = model === DEFAULT_MODEL ? 1 : 30;
    return createSubmissionBuilder({
        prompt: 'A programmer at night, using [Image 1] as the person reference.',
        seconds: 5,
        model,
        ratio: '16:9',
        resolution: '720p',
        finalResolution: '720p',
        draft: false,
        voiceLanguage: 'silent',
        captionMode: 'none',
        cameraFixed: false,
        watermark: false,
        watermarkText: '',
        titleOverlayEnabled: false,
        titleOverlayText: '',
        titleOverlayStyle: '',
        titleOverlayDuration: '',
        titleOverlayLanguage: '',
        referenceUrls,
        referenceCap,
        singleImageMode: mode,
        lastFrameUrl: '',
        referenceAudioUrl: audioUrl,
        referenceAudioRange,
        showReferenceAudio: canUseReferenceAudio(referenceUrls.length, referenceCap, mode),
        referenceVideoUrls: [],
        referenceVideoSecondsByUrl: {},
        showReferenceVideos: false
    })();
}

describe('single image generation mode', () => {
    it('uses one 2.x image as a visual reference and sends the selected landscape ratio', () => {
        const data = buildSubmission();
        expect(data.reference_image_urls).toEqual(['asset://portrait-1']);
        expect(data.input_reference_url).toBeUndefined();
        const body = buildCreateBody(data);
        expect(body.input_reference).toEqual([{ url: 'asset://portrait-1', role: 'reference_image' }]);
        expect(body.extra_body).toMatchObject({ ratio: '16:9', seedance_use_asset_api: true });
    });

    it('accepts an audio reference with one visual-reference image and enables generated audio', () => {
        const data = buildSubmission(DEFAULT_VIDEO_REFERENCE_MODEL, 'reference', 'https://example.com/music.mp3');
        expect(data.reference_audio_url).toBe('https://example.com/music.mp3');
        expect(data.generate_audio).toBe(true);
        expect(buildCreateBody(data).input_reference).toEqual([
            { url: 'asset://portrait-1', role: 'reference_image' },
            { url: 'https://example.com/music.mp3', role: 'reference_audio' }
        ]);
    });

    it('limits the selected audio excerpt to this submission’s video duration', () => {
        const data = buildSubmission(DEFAULT_VIDEO_REFERENCE_MODEL, 'reference', 'https://example.com/music.mp3', [], {
            startSeconds: 48,
            endSeconds: 78
        });
        expect(data.reference_audio_range).toEqual({ startSeconds: 48, endSeconds: 53 });
        expect(buildCreateBody(data)).not.toHaveProperty('reference_audio_range');
    });

    it('shows audio without a reference image and submits prompt plus audio', () => {
        const data = buildSubmission(DEFAULT_VIDEO_REFERENCE_MODEL, 'reference', 'https://example.com/music.mp3', []);
        expect(data.reference_image_urls).toBeUndefined();
        expect(data.reference_audio_url).toBe('https://example.com/music.mp3');
        expect(data.generate_audio).toBe(true);
        const body = buildCreateBody(data);
        expect(body.input_reference).toEqual([{ url: 'https://example.com/music.mp3', role: 'reference_audio' }]);
        expect(body.extra_body).toMatchObject({ ratio: '16:9', generate_audio: true });
    });

    it('keeps exact first-frame mode image-driven without a conflicting ratio', () => {
        const data = buildSubmission(DEFAULT_VIDEO_REFERENCE_MODEL, 'first-frame', 'https://example.com/music.mp3');
        expect(data.input_reference_url).toBe('asset://portrait-1');
        expect(data.reference_audio_url).toBeUndefined();
        expect(data.generate_audio).toBe(false);
        const body = buildCreateBody(data);
        expect(body.input_reference).toBe('asset://portrait-1');
        expect(body.extra_body).not.toHaveProperty('ratio');
    });

    it('keeps 1.5 in first-frame mode even if reference mode was previously selected', () => {
        const data = buildSubmission(DEFAULT_MODEL);
        expect(data.input_reference_url).toBe('asset://portrait-1');
        expect(data.reference_image_urls).toBeUndefined();
    });

    it('does not require images for audio but excludes exact first-frame and first-frame-only models', () => {
        expect(canUseReferenceAudio(0, 30, 'reference')).toBe(true);
        expect(canUseReferenceAudio(0, 30, 'first-frame')).toBe(true);
        expect(canUseReferenceAudio(1, 30, 'reference')).toBe(true);
        expect(canUseReferenceAudio(1, 30, 'first-frame')).toBe(false);
        expect(canUseReferenceAudio(2, 30, 'first-frame')).toBe(true);
        expect(canUseReferenceAudio(1, 1, 'reference')).toBe(false);
        expect(canUseReferenceAudio(0, 1, 'reference')).toBe(false);
    });
});
