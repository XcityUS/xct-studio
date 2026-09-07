import { SHARE_PROMPT_LIMIT } from '@/features/studio/components/StudioWorkspace/constants';
import {
    ensureFinalizeEditPrompt,
    inputVideoSecondsFromParams
} from '@/features/studio/components/StudioWorkspace/finalize';
import {
    captionModeFromLanguages,
    shareParamsToForm,
    sharePromptWithinLimit,
    shareTitleFromPrompt
} from '@/features/studio/components/StudioWorkspace/share';
import { DEFAULT_MODEL, DEFAULT_RATIO, DEFAULT_RESOLUTION } from '@/shared/config/seedance';
import { describe, expect, it } from 'vitest';

describe('extracted Studio share transformations', () => {
    it('normalizes titles and enforces share text limits', () => {
        expect(shareTitleFromPrompt('  Scene\n  One ')).toBe('Scene One');
        expect(shareTitleFromPrompt('   ')).toBe('Xcity Studio video');
        expect(shareTitleFromPrompt('a'.repeat(121))).toBe(`${'a'.repeat(117)}...`);
        expect(sharePromptWithinLimit(`  ${'a'.repeat(SHARE_PROMPT_LIMIT + 1)}  `)).toHaveLength(SHARE_PROMPT_LIMIT);
    });

    it('maps source caption languages without inventing unsupported tracks', () => {
        expect(captionModeFromLanguages(undefined)).toBeUndefined();
        expect(captionModeFromLanguages(['fr-FR'])).toBeUndefined();
        expect(captionModeFromLanguages(['zh-CN', 'zh-CN'])).toBe('zh-CN');
        expect(captionModeFromLanguages(['en-US'])).toBe('en-US');
        expect(captionModeFromLanguages(['zh-CN', 'en-US'])).toBe('bilingual-en-zh');
    });

    it('handles untrusted share metadata with valid generation defaults', () => {
        for (const metadata of [null, [], 'invalid', { model: 'unsupported', ratio: 'bad', resolution: 'bad' }]) {
            const { params } = shareParamsToForm('A quiet scene', metadata);
            expect(params).toMatchObject({
                model: DEFAULT_MODEL,
                ratio: DEFAULT_RATIO,
                resolution: DEFAULT_RESOLUTION
            });
            expect(Number.isFinite(params.seconds)).toBe(true);
            expect(params.generated_captions).toBeUndefined();
        }
    });
});

describe('extracted finalize transformations', () => {
    it('preserves an existing edit instruction and adds it only when absent', () => {
        expect(ensureFinalizeEditPrompt(' Edit the reference video, keep the character. ')).toBe(
            'Edit the reference video, keep the character.'
        );
        const added = ensureFinalizeEditPrompt('Keep the character.');
        expect(added).toContain('Keep the character.');
        expect(ensureFinalizeEditPrompt(added)).toBe(added);
    });

    it('counts only finite positive durations belonging to referenced videos', () => {
        const params = {
            prompt: '',
            model: DEFAULT_MODEL,
            ratio: DEFAULT_RATIO,
            resolution: DEFAULT_RESOLUTION,
            seconds: 5,
            generate_audio: true
        };
        expect(inputVideoSecondsFromParams(params)).toBe(0);
        expect(
            inputVideoSecondsFromParams({
                ...params,
                reference_video_urls: ['one', 'two', 'three'],
                reference_video_seconds: [3, -1, NaN, 100]
            })
        ).toBe(3);
    });
});
