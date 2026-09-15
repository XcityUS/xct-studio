import {
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
});
