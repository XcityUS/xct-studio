import { createSharedSubtitle } from '@/app/[locale]/video/[id]/media';
import { describe, expect, it } from 'vitest';

describe('shared video subtitles', () => {
    it('reuses the persisted cloud cue instead of estimating timing again', () => {
        const subtitle = createSharedSubtitle({
            id: 'shared-id',
            prompt: 'Tina: Hello there.\n蒂娜：你好。',
            params: {
                caption_mode: 'auto-bilingual-en-zh',
                seconds: 30,
                voice_language: 'en-US',
                caption_track: {
                    status: 'completed',
                    delivery: 'player',
                    cues: [
                        {
                            id: 'cue-1',
                            startMs: 1420,
                            endMs: 2860,
                            english: 'Hello there.',
                            chinese: '你好。'
                        }
                    ]
                }
            }
        });

        expect(subtitle?.type).toBe('srt');
        expect(decodeURIComponent(subtitle?.url ?? '')).toContain('00:00:01,420 --> 00:00:02,860');
    });
});
