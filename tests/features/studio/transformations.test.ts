import {
    captionDelivery,
    normalizeCaptionMode,
    promptWithLanguageControls,
    shouldAvoidGeneratedCaptions
} from '@/features/script/prompt/guards';
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
        expect(captionModeFromLanguages(['zh-CN', 'zh-CN'])).toBe('auto-zh-CN');
        expect(captionModeFromLanguages(['en-US'])).toBe('auto-en-US');
        expect(captionModeFromLanguages(['zh-CN', 'en-US'])).toBe('auto-bilingual-en-zh');
    });

    it('normalizes legacy modes and only disables provider captions for the none mode', () => {
        expect(normalizeCaptionMode('en-US')).toBe('auto-en-US');
        expect(normalizeCaptionMode('zh-CN')).toBe('auto-zh-CN');
        expect(normalizeCaptionMode('bilingual-en-zh')).toBe('auto-bilingual-en-zh');
        expect(normalizeCaptionMode('provider-auto')).toBe('auto-en-US');
        expect(normalizeCaptionMode('provider-bilingual-en-zh')).toBe('auto-bilingual-en-zh');
        expect(shouldAvoidGeneratedCaptions('none')).toBe(true);
        expect(shouldAvoidGeneratedCaptions('auto-en-US')).toBe(false);
        expect(shouldAvoidGeneratedCaptions('auto-bilingual-en-zh')).toBe(false);
        expect(shouldAvoidGeneratedCaptions('burn-bilingual-en-zh')).toBe(false);
        expect(captionDelivery('auto-bilingual-en-zh')).toBe('player');
        expect(captionDelivery('burn-bilingual-en-zh')).toBe('burned');
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

    it('does not add a conflicting no-caption instruction for Studio burn-in', () => {
        const prompt = promptWithLanguageControls('A short greeting scene.', {
            voiceLanguage: 'en-US',
            captionMode: 'burn-bilingual-en-zh'
        });

        expect(prompt).not.toContain('do not render captions or on-screen subtitle text');
        expect(prompt).toContain('permanently burn the selected script-timed subtitles');
        expect(prompt).not.toContain('generate bilingual subtitles');
    });

    it('requires provider-rendered subtitles according to the selected automatic mode', () => {
        const automatic = promptWithLanguageControls('A short greeting scene.', {
            voiceLanguage: 'en-US',
            captionMode: 'auto-en-US'
        });
        const bilingual = promptWithLanguageControls('A short greeting scene.', {
            voiceLanguage: 'en-US',
            captionMode: 'auto-bilingual-en-zh'
        });

        expect(automatic).toContain('Render visible American English subtitles directly in the generated video');
        expect(automatic).not.toContain('do not render captions or on-screen subtitle text');
        expect(automatic).toContain('timed player subtitle track directly from the selected script');
        expect(bilingual).toContain('Render visible bilingual subtitles directly in the generated video');
        expect(bilingual).toContain('The first line must be English');
        expect(bilingual).toContain('The second line directly below it must be concise Simplified Chinese');
        expect(bilingual).toContain('Subtitles are required, not optional');
        expect(bilingual.startsWith('Priority parameter constraints:\nLanguage instructions:')).toBe(true);
        expect(bilingual.indexOf('Priority parameter constraints:')).toBeLessThan(
            bilingual.indexOf('Creative content:')
        );
        expect(bilingual.indexOf('Creative content:')).toBeLessThan(bilingual.indexOf('Final parameter lock:'));
    });

    it('recovers creative content after parameter constraints are compiled around it', () => {
        const source = 'Scene: A family watches television.\nSister: I like this show!';
        const compiled = promptWithLanguageControls(source, {
            voiceLanguage: 'en-US',
            captionMode: 'auto-bilingual-en-zh'
        });

        expect(
            promptWithLanguageControls(compiled, {
                voiceLanguage: 'en-US',
                captionMode: 'auto-bilingual-en-zh'
            })
        ).toContain(`Creative content:\n${source}`);
    });

    it('excludes scene directions and retains multi-speaker English dialogue for audio', () => {
        const prompt = promptWithLanguageControls(
            'Scene: A family watches television.\nBrother & Sister: Hahaha! Papa Bear!',
            { voiceLanguage: 'en-US', captionMode: 'burn-bilingual-en-zh' }
        );

        expect(prompt).toContain('Brother & Sister: Hahaha! Papa Bear!');
        expect(prompt).not.toContain('Audio-only dialogue script to speak');
        expect(prompt.match(/Brother & Sister: Hahaha! Papa Bear!/g)).toHaveLength(1);
    });

    it('keeps Chinese subtitle references in creative content while enforcing English-only speech', () => {
        const prompt = promptWithLanguageControls('妹妹：我想重新开始。\nSister: I want to start again.', {
            voiceLanguage: 'en-US',
            captionMode: 'auto-bilingual-en-zh'
        });

        expect(prompt).toContain('妹妹：我想重新开始。');
        expect(prompt).toContain('Sister: I want to start again.');
        expect(prompt).toContain('Never read Chinese source text aloud');
        expect(prompt).toContain('every spoken word in the soundtrack must be natural American English');
    });

    it('asks the video model to translate Chinese-only narration before speaking English', () => {
        const prompt = promptWithLanguageControls('有些遗憾无法重来，但故事还没有结束。', {
            voiceLanguage: 'en-US',
            captionMode: 'auto-bilingual-en-zh'
        });

        expect(prompt).toContain('translate its meaning into natural American English before speaking');
        expect(prompt).toContain('never generate Mandarin or Chinese speech');
    });

    it('keeps both members of plain bilingual narration pairs as subtitle source material', () => {
        const prompt = promptWithLanguageControls(
            '有些遗憾无法重来，但故事还没有结束。\n\nSome regrets cannot be undone, but the story is not over yet.',
            { voiceLanguage: 'en-US', captionMode: 'auto-bilingual-en-zh' }
        );

        expect(prompt).toContain('有些遗憾无法重来');
        expect(prompt).toContain('Some regrets cannot be undone');
    });

    it('keeps generated dialogue sequential without asking the model to render opening titles', () => {
        const prompt = promptWithLanguageControls('Two adults talk in an office.', {
            voiceLanguage: 'zh-CN',
            captionMode: 'burn-zh-CN',
            titleOverlay: { enabled: true, text: '市场震荡', duration: 'opening-1s' }
        });

        expect(prompt).toContain('Only one person may speak at a time');
        expect(prompt).toContain('never overlap two voices');
        expect(prompt).not.toContain('Title overlay instructions');
        expect(prompt).not.toContain('Opening title');
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
