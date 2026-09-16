import { renderTextOverlays } from '@/features/post-production/overlays/render';
import type { VideoJobCreate } from '@/shared/contracts/video';
import { describe, expect, it } from 'vitest';

const params: VideoJobCreate = {
    model: 'seedance-1-5-pro-251215',
    prompt: 'Sister: Hello!\n妹妹：你好！',
    ratio: '16:9',
    resolution: '480p',
    seconds: 5,
    generate_audio: true,
    voice_language: 'en-US',
    caption_mode: 'auto-bilingual-en-zh'
};

describe('generation overlay rendering', () => {
    it('uses generated-audio timestamps for automatic player subtitles', async () => {
        const film = new Blob(['video'], { type: 'video/mp4' });
        const result = await renderTextOverlays(film, params, params.prompt, {
            transcribe: async () => [{ start: 1.1, end: 2.2, text: 'Hello!' }]
        });

        expect(result.film).toBe(film);
        expect(result.captionTrack).toMatchObject({
            status: 'completed',
            source: 'transcription-aligned-script',
            cues: [{ startMs: 1100, endMs: 2200 }]
        });
    });

    it('keeps script-timed captions as a non-blocking fallback', async () => {
        const result = await renderTextOverlays(new Blob(['video']), params, params.prompt, {
            transcribe: async () => {
                throw new Error('transcription unavailable');
            }
        });

        expect(result.captionTrack).toMatchObject({
            status: 'completed',
            source: 'script-timed',
            expectedDialogueCount: 1
        });
    });
});
