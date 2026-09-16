import {
    renderAlignedCaptions,
    renderScriptBurnedCaptions,
    renderScriptCaptions
} from '@/features/post-production/captions/process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { burnCaptionsIntoVideo } = vi.hoisted(() => ({ burnCaptionsIntoVideo: vi.fn() }));

vi.mock('@/features/post-production/assembly/client', () => ({
    burnCaptionsIntoVideo
}));

const prompt = `妹妹：你好！
Sister: Hello!`;

describe('caption delivery', () => {
    beforeEach(() => burnCaptionsIntoVideo.mockReset());

    it('creates automatic player subtitles directly from the script without transcription', () => {
        const film = new Blob(['original'], { type: 'video/mp4' });
        const result = renderScriptCaptions(film, {
            mode: 'bilingual-en-zh',
            prompt,
            voiceLanguage: 'en-US',
            durationSeconds: 5
        });

        expect(result.film).toBe(film);
        expect(result.track).toMatchObject({
            status: 'completed',
            delivery: 'player',
            source: 'script-timed',
            matchedDialogueCount: 1,
            transcriptSegmentCount: 0
        });
        expect(burnCaptionsIntoVideo).not.toHaveBeenCalled();
    });

    it('writes the script-timed SRT into the video without transcription', async () => {
        const film = new Blob(['original'], { type: 'video/mp4' });
        const burned = new Blob(['burned'], { type: 'video/mp4' });
        burnCaptionsIntoVideo.mockResolvedValue(burned);

        const result = await renderScriptBurnedCaptions(film, {
            mode: 'bilingual-en-zh',
            prompt,
            voiceLanguage: 'en-US',
            durationSeconds: 5
        });

        expect(result.film).toBe(burned);
        expect(result.track).toMatchObject({
            status: 'completed',
            delivery: 'burned',
            source: 'script-timed',
            matchedDialogueCount: 1,
            transcriptSegmentCount: 0
        });
        expect(burnCaptionsIntoVideo).toHaveBeenCalledTimes(1);
        expect(burnCaptionsIntoVideo.mock.calls[0]?.[1]?.srt).toContain('Hello!\n你好！');
    });

    it('keeps long burned dialogue as one timed cue for renderer wrapping', async () => {
        burnCaptionsIntoVideo.mockResolvedValue(new Blob(['burned']));
        const longPrompt = `Receptionist: Everyone has a chance to correct mistakes and take responsibility for the work before a final decision is made.\n接待员：最终决定前，每个人都有改正错误并对工作负责的机会。`;

        const result = await renderScriptBurnedCaptions(new Blob(['original']), {
            mode: 'bilingual-en-zh',
            prompt: longPrompt,
            voiceLanguage: 'en-US',
            durationSeconds: 8
        });

        expect(result.track.cues).toHaveLength(1);
        expect(burnCaptionsIntoVideo.mock.calls[0]?.[1]?.srt).toContain('take responsibility');
    });

    it('persists audio-aligned player cues without burning the video', async () => {
        const film = new Blob(['original'], { type: 'video/mp4' });
        const result = await renderAlignedCaptions(film, {
            mode: 'bilingual-en-zh',
            delivery: 'player',
            prompt,
            voiceLanguage: 'en-US',
            transcribe: async () => [{ start: 1.25, end: 2.4, text: 'Hello!' }]
        });

        expect(result.film).toBe(film);
        expect(result.track).toMatchObject({
            status: 'completed',
            delivery: 'player',
            source: 'transcription-aligned-script',
            matchedDialogueCount: 1,
            transcriptSegmentCount: 1
        });
        expect(result.track.cues[0]).toMatchObject({ startMs: 1250, endMs: 2400 });
        expect(burnCaptionsIntoVideo).not.toHaveBeenCalled();
    });
});
