import {
    alignDialogueCaptions,
    captionCuesToSrt,
    extractDialogueBeats,
    timeScriptCaptions
} from '@/features/post-production/captions/alignment';
import { describe, expect, it } from 'vitest';

const SCRIPT = `Scene: Dad, Brother, and Little Sister watch television.
妹妹： 我喜欢《玛莎与熊》，但是我不喜欢玛莎！
Sister: I like Masha and the Bear, but I don’t like Masha!
爸爸： 为什么？我觉得你很像玛莎呀。
Dad: Why? I think you’re a lot like Masha.
哥哥 & 妹妹： 哈哈哈！熊爸爸！
Brother & Sister: Hahaha! Papa Bear!`;

const FULL_SCRIPT_WITH_CONFLICTING_DIRECTIVE = `Scene: Dad (40, wearing glasses), Brother (7), and Little Sister (3) are sitting together watching Masha and the Bear.

妹妹： 我喜欢《玛莎与熊》，但是我不喜欢玛莎！
Sister: I like Masha and the Bear, but I don’t like Masha!
爸爸： 为什么？我觉得你很像玛莎呀。
Dad: Why? I think you’re a lot like Masha.
妹妹： 我才不像她！她太调皮了！
Sister: I’m not like her! She’s too naughty!
哥哥： 哈哈，我觉得你就是玛莎！
Brother: Haha! I think you are Masha!
妹妹： 才不是！那你是谁？
Sister: No, I’m not! Then who are you?
哥哥： 我是企鹅！
Brother: I’m the penguin!
妹妹： 那爸爸呢？
Sister: What about Dad?
哥哥： 爸爸当然是熊！
Brother: Dad is definitely the bear!
爸爸： 为什么我是熊？
Dad: Why am I the bear?
妹妹： 因为你每天都要照顾我们两个呀！
Sister: Because you have to take care of both of us every day!
爸爸： 好吧，那熊爸爸抱抱你们！
Dad: All right. Come give Papa Bear a hug!
哥哥 & 妹妹： 哈哈哈！熊爸爸！
Brother & Sister: Hahaha! Papa Bear!
Language instructions:
Subtitles are required, not optional. Render visible bilingual subtitles directly into the original generated video.`;

const INTERVIEW_SCRIPT = `Job Interview: Qualifications
求职面试：岗位资格要求

Brook: What are the requirements for this position?
布鲁克：应聘这个职位有什么要求？

Interviewer: Your major must be computer-related.
面试官：你的专业必须与计算机相关。`;

describe('ordinary-video caption alignment', () => {
    it('extracts bilingual dialogue pairs and excludes scene directions', () => {
        expect(extractDialogueBeats(SCRIPT)).toEqual([
            {
                chinese: '我喜欢《玛莎与熊》，但是我不喜欢玛莎！',
                english: 'I like Masha and the Bear, but I don’t like Masha!'
            },
            { chinese: '为什么？我觉得你很像玛莎呀。', english: 'Why? I think you’re a lot like Masha.' },
            { chinese: '哈哈哈！熊爸爸！', english: 'Hahaha! Papa Bear!' }
        ]);
    });

    it('excludes a leading bilingual title from the dialogue count', () => {
        expect(extractDialogueBeats(INTERVIEW_SCRIPT)).toEqual([
            {
                english: 'What are the requirements for this position?',
                chinese: '应聘这个职位有什么要求？'
            },
            {
                english: 'Your major must be computer-related.',
                chinese: '你的专业必须与计算机相关。'
            }
        ]);
    });

    it('falls back to plain narration lines when speaker prefixes are absent', () => {
        expect(extractDialogueBeats('有些遗憾无法重来，但故事还没有结束。')).toEqual([
            { chinese: '有些遗憾无法重来，但故事还没有结束。' }
        ]);
        expect(extractDialogueBeats('Some regrets cannot be undone, but the story is not over yet.')).toEqual([
            { english: 'Some regrets cannot be undone, but the story is not over yet.' }
        ]);
        expect(extractDialogueBeats('有些遗憾无法重来。\nSome regrets cannot be undone.')).toEqual([
            { chinese: '有些遗憾无法重来。', english: 'Some regrets cannot be undone.' }
        ]);
    });

    it('uses actual transcription timestamps and renders English above Chinese', () => {
        const aligned = alignDialogueCaptions(
            SCRIPT,
            [
                { start: 1.2, end: 4.8, text: "I like Masha and the Bear, but I don't like Masha!" },
                { start: 5.1, end: 7.6, text: "Why? I think you're a lot like Masha." },
                { start: 8, end: 9.4, text: 'Hahaha! Papa Bear!' }
            ],
            'bilingual-en-zh',
            'en-US'
        );

        expect(aligned).toMatchObject({
            expectedDialogueCount: 3,
            matchedDialogueCount: 3,
            transcriptSegmentCount: 3
        });
        expect(aligned.cues[0].startMs).toBe(1200);
        expect(aligned.cues.at(-1)?.endMs).toBe(9400);
        expect(aligned.cues.every((cue) => cue.english && cue.chinese)).toBe(true);

        const srt = captionCuesToSrt(aligned.cues);
        expect(srt).toContain('00:00:01,200 -->');
        expect(srt.indexOf('I like Masha')).toBeLessThan(srt.indexOf('我喜欢'));
    });

    it('matches a long dialogue beat across multiple transcription sentences', () => {
        const prompt = `Receptionist: Yes. That's true. We are always busy. The company attaches great importance to high efficiency. Sometimes we have to work overtime, but not always. And we have extra pay for extra work.
接待员：是的。确实是这样。我们总是很忙。公司非常讲究高效率。有时我们得加班，但并不总是这样。而且加班的时候有加班费。`;
        const aligned = alignDialogueCaptions(
            prompt,
            [
                {
                    start: 19.76,
                    end: 25.62,
                    text: "Yes. That's true. We are always busy. The company attaches great importance to high efficiency. Sometimes we have to work overtime, but not always. And we have extra pay for extra work."
                }
            ],
            'bilingual-en-zh',
            'en-US'
        );

        expect(aligned.matchedDialogueCount).toBe(1);
        expect(aligned.cues[0].startMs).toBe(19_760);
        expect(aligned.cues.at(-1)?.endMs).toBe(25_620);
    });

    it('matches long dialogue against word-level timestamps without cutting its beginning', () => {
        const prompt = `Tina: Excuse me. Do you mind if I ask some things about work for this company?\n蒂娜：打扰一下。您介意我问一些有关这个公司的工作吗？`;
        const words = [
            'Excuse',
            'me',
            'Do',
            'you',
            'mind',
            'if',
            'I',
            'ask',
            'some',
            'things',
            'about',
            'work',
            'for',
            'this',
            'company'
        ].map((text, index) => ({ start: 0.6 + index * 0.16, end: 0.74 + index * 0.16, text }));

        const aligned = alignDialogueCaptions(prompt, words, 'bilingual-en-zh', 'en-US');

        expect(aligned.matchedDialogueCount).toBe(1);
        expect(aligned.cues[0].startMs).toBe(600);
        expect(aligned.cues.at(-1)?.endMs).toBeCloseTo(2_980, -1);
    });

    it('times bilingual player subtitles from the script when transcription is unavailable', () => {
        const timed = timeScriptCaptions(SCRIPT, 'bilingual-en-zh', 'en-US', 12);

        expect(timed).toMatchObject({
            expectedDialogueCount: 3,
            matchedDialogueCount: 3,
            transcriptSegmentCount: 0
        });
        expect(timed.cues.length).toBeGreaterThanOrEqual(3);
        expect(timed.cues[0].startMs).toBeGreaterThanOrEqual(0);
        expect(timed.cues.at(-1)?.endMs).toBeLessThanOrEqual(12_000);
        expect(timed.cues.every((cue) => cue.english && cue.chinese)).toBe(true);
    });

    it('keeps a long bilingual dialogue together when it fits the player cue limits', () => {
        const timed = timeScriptCaptions(
            `Tina: It seems that working in a foreign enterprise is not the same as I expected. Thank you for your help.\n蒂娜：看来在外企工作和我以前想象的不一样。谢谢您。`,
            'bilingual-en-zh',
            'en-US',
            8
        );

        expect(timed.cues).toHaveLength(1);
        expect(timed.cues[0]).toMatchObject({
            english:
                'It seems that working in a foreign enterprise is not the same as I expected. Thank you for your help.',
            chinese: '看来在外企工作和我以前想象的不一样。谢谢您。'
        });
    });

    it('keeps a complete long dialogue in one player subtitle cue', () => {
        const timed = timeScriptCaptions(
            `Receptionist: Yes. That's true. We are always busy. The company attaches great importance to high efficiency. Sometimes we have to work overtime, but not always. And we have extra pay for extra work.\n接待员：是的。确实是这样。我们总是很忙。公司非常讲究高效率。有时我们得加班，但并不总是这样。而且加班的时候有加班费。`,
            'bilingual-en-zh',
            'en-US',
            12
        );

        expect(timed.cues).toHaveLength(1);
        expect(timed.cues[0].english).toMatch(/^Yes\..*extra work\.$/);
        expect(timed.cues[0].chinese).toMatch(/^是的。.*加班费。$/);
    });

    it('estimates dialogue timing from spoken words and punctuation pauses', () => {
        const timed = timeScriptCaptions(
            `Tina: Please continue.\n蒂娜：请继续。\nReceptionist: Everyone has a chance to correct his or her mistakes before a final decision is made.\n接待员：最终决定前，每个人都有改正错误的机会。`,
            'bilingual-en-zh',
            'en-US',
            12
        );

        expect(timed.cues).toHaveLength(2);
        expect(timed.cues[0].endMs).toBeLessThan(4_000);
        expect(timed.cues[1].endMs - timed.cues[1].startMs).toBeGreaterThan(
            timed.cues[0].endMs - timed.cues[0].startMs
        );
    });

    it('keeps all bilingual dialogue pairs from the full source script despite appended prompt directives', () => {
        const timed = timeScriptCaptions(FULL_SCRIPT_WITH_CONFLICTING_DIRECTIVE, 'bilingual-en-zh', 'en-US', 30);

        expect(timed.expectedDialogueCount).toBe(12);
        expect(timed.matchedDialogueCount).toBe(12);
        expect(timed.cues.every((cue) => cue.english && cue.chinese)).toBe(true);
        expect(timed.cues.map((cue) => cue.english).join(' ')).toContain('Papa Bear');
        expect(timed.cues.map((cue) => cue.chinese).join('')).toContain('熊爸爸');
    });

    it('still creates a cue when narration exists only in the non-voice language', () => {
        const timed = timeScriptCaptions('有些遗憾无法重来，但故事还没有结束。', 'bilingual-en-zh', 'en-US', 12);

        expect(timed.expectedDialogueCount).toBe(1);
        expect(timed.cues).toHaveLength(1);
        expect(timed.cues.every((cue) => cue.chinese)).toBe(true);
    });

    it('does not burn source lines that were not found in the generated audio', () => {
        const aligned = alignDialogueCaptions(
            SCRIPT,
            [{ start: 2, end: 3, text: 'Hahaha! Papa Bear!' }],
            'bilingual-en-zh',
            'en-US'
        );

        expect(aligned.matchedDialogueCount).toBe(1);
        expect(aligned.cues.map((cue) => cue.english).join(' ')).toContain('Papa Bear');
        expect(aligned.cues.map((cue) => cue.english).join(' ')).not.toContain('Masha');
    });
});
