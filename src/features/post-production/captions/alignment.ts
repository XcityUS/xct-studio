import { cleanPromptForReuse, type VoiceLanguage } from '@/features/script/prompt/guards';
import type { CaptionSegment } from '@/lib/captions';
import type { CaptionCue } from '@/shared/contracts/video';

export const MAX_ENGLISH_CAPTION_CUE_LENGTH = 112;
export const MAX_CHINESE_CAPTION_CUE_LENGTH = 48;

type DialogueBeat = {
    english?: string;
    chinese?: string;
};

type TimedText = CaptionSegment & { normalized: string };

const STAGE_LABEL = /^(?:scene|shot|setting|场景|镜头|画面)$/i;
const NON_CAPTION_LINE =
    /^(?:scene|shot|setting|camera|visual|style|lighting|audio|music|sound|negative prompt|场景|镜头|画面|运镜|灯光|音效|音乐)\s*[:：]/i;
const HAN_TEXT = /[\u3400-\u9fff]/;

function dialogueLine(line: string) {
    const match = /^([^:：\n]{1,50})[:：]\s*(.+)$/.exec(line.trim());
    if (!match || STAGE_LABEL.test(match[1].trim())) return undefined;
    const text = match[2].trim();
    if (!text) return undefined;
    if (HAN_TEXT.test(text)) return { language: 'chinese' as const, text };
    if (/[A-Za-z]{2,}/.test(text)) return { language: 'english' as const, text };
    return undefined;
}

export function extractDialogueBeats(prompt: string): DialogueBeat[] {
    const beats: DialogueBeat[] = [];
    const sourceLines = cleanPromptForReuse(prompt).split(/\r?\n/);
    for (const rawLine of sourceLines) {
        const line = dialogueLine(rawLine);
        if (!line) continue;
        const previous = beats.at(-1);
        const completesPair =
            previous &&
            previous[line.language] === undefined &&
            ((line.language === 'english' && previous.chinese !== undefined) ||
                (line.language === 'chinese' && previous.english !== undefined));
        if (completesPair) {
            previous[line.language] = line.text;
        } else {
            beats.push({ [line.language]: line.text });
        }
    }
    if (beats.length > 0) {
        const first = beats[0];
        const leadingBilingualHeading =
            beats.length > 1 &&
            first.english &&
            first.chinese &&
            !/[.!?。！？]$/.test(first.english) &&
            !/[.!?。！？]$/.test(first.chinese);
        return leadingBilingualHeading ? beats.slice(1) : beats;
    }

    // Narration prompts often contain the spoken copy as plain prose without a
    // `Speaker:` prefix. Keep explicit scene/camera directions out, but use
    // the remaining source lines so automatic captions do not fail outright.
    const fallback: DialogueBeat[] = [];
    for (const rawLine of sourceLines) {
        const text = rawLine
            .trim()
            .replace(/^[-*#>\d.)\s]+/, '')
            .trim();
        if (!text || NON_CAPTION_LINE.test(text)) continue;
        const language = HAN_TEXT.test(text)
            ? ('chinese' as const)
            : /[A-Za-z]{2,}/.test(text)
              ? ('english' as const)
              : undefined;
        if (!language) continue;
        const previous = fallback.at(-1);
        if (previous && previous[language] === undefined) {
            previous[language] = text;
        } else {
            fallback.push({ [language]: text });
        }
    }
    return fallback;
}

function normalizedSpeech(text: string) {
    return text
        .toLocaleLowerCase()
        .replace(/^([^:：\n]{1,50})[:：]\s*/, '')
        .replace(/[’']/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '');
}

function estimatedSpeechWeight(text: string) {
    const punctuationCount = text.match(/[,.!?;:，。！？；：]/g)?.length ?? 0;
    if (HAN_TEXT.test(text) && !/[A-Za-z]{2,}/.test(text)) {
        const characterCount = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
        return Math.max(1, characterCount + punctuationCount * 2);
    }
    const wordCount = text.match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu)?.length ?? 0;
    return Math.max(1, wordCount + punctuationCount * 0.6);
}

function bigrams(text: string) {
    if (text.length < 2) return new Set(text ? [text] : []);
    return new Set(Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)));
}

function similarity(left: string, right: string) {
    if (!left || !right) return 0;
    if (left === right) return 1;
    if (left.includes(right) || right.includes(left))
        return Math.min(left.length, right.length) / Math.max(left.length, right.length);
    const leftPairs = bigrams(left);
    const rightPairs = bigrams(right);
    let overlap = 0;
    leftPairs.forEach((pair) => {
        if (rightPairs.has(pair)) overlap += 1;
    });
    return (2 * overlap) / Math.max(1, leftPairs.size + rightPairs.size);
}

function sentenceParts(text: string, partCount: number) {
    if (partCount <= 1) return [text];
    const sentences = text.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g)?.map((value) => value.trim()) ?? [];
    if (sentences.length < partCount) return undefined;

    const parts: string[] = [];
    let cursor = 0;
    for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
        const remainingParts = partCount - partIndex;
        if (remainingParts === 1) {
            parts.push(sentences.slice(cursor).join(' '));
            break;
        }
        const availableEnd = sentences.length - remainingParts + 1;
        const remainingLength = sentences.slice(cursor).join(' ').length;
        const targetLength = remainingLength / remainingParts;
        let end = cursor + 1;
        while (end < availableEnd) {
            const currentLength = sentences.slice(cursor, end).join(' ').length;
            const nextLength = sentences.slice(cursor, end + 1).join(' ').length;
            if (Math.abs(currentLength - targetLength) <= Math.abs(nextLength - targetLength)) break;
            end += 1;
        }
        parts.push(sentences.slice(cursor, end).join(' '));
        cursor = end;
    }
    return parts;
}

function transcriptPieces(segments: readonly CaptionSegment[]): TimedText[] {
    return segments.flatMap((segment) => {
        const parts = segment.text
            .trim()
            .split(/(?<=[.!?。！？])\s+/)
            .filter(Boolean);
        if (parts.length <= 1) return [{ ...segment, normalized: normalizedSpeech(segment.text) }];
        const weights = parts.map((part) => Math.max(1, normalizedSpeech(part).length));
        const total = weights.reduce((sum, value) => sum + value, 0);
        let elapsed = segment.start;
        return parts.map((text, index) => {
            const end =
                index === parts.length - 1
                    ? segment.end
                    : elapsed + ((segment.end - segment.start) * weights[index]) / total;
            const piece = { start: elapsed, end, text, normalized: normalizedSpeech(text) };
            elapsed = end;
            return piece;
        });
    });
}

function splitText(text: string, maxLength: number, partCount: number) {
    const semanticParts = sentenceParts(text, partCount);
    if (semanticParts) return semanticParts;
    const words = text.includes(' ') ? text.split(/\s+/) : Array.from(text);
    const parts: string[] = [];
    let current = '';
    for (const word of words) {
        const separator = text.includes(' ') && current ? ' ' : '';
        if (current && current.length + separator.length + word.length > maxLength) {
            parts.push(current);
            current = word;
        } else {
            current += `${separator}${word}`;
        }
    }
    if (current) parts.push(current);
    while (parts.length < partCount) {
        const index = parts.reduce(
            (best, part, currentIndex) => (part.length > parts[best].length ? currentIndex : best),
            0
        );
        const value = parts[index];
        const splitAt = text.includes(' ')
            ? value.lastIndexOf(' ', Math.ceil(value.length / 2))
            : Math.ceil(value.length / 2);
        if (splitAt <= 0) break;
        parts.splice(index, 1, value.slice(0, splitAt).trim(), value.slice(splitAt).trim());
    }
    return parts;
}

function displayCues(
    beat: DialogueBeat,
    start: number,
    end: number,
    mode: 'en-US' | 'zh-CN' | 'bilingual-en-zh',
    cuePrefix: string
): CaptionCue[] {
    const english = mode !== 'zh-CN' ? beat.english : undefined;
    const chinese = mode !== 'en-US' ? beat.chinese : undefined;
    const partCount = Math.max(
        1,
        english ? Math.ceil(english.length / MAX_ENGLISH_CAPTION_CUE_LENGTH) : 0,
        chinese ? Math.ceil(chinese.length / MAX_CHINESE_CAPTION_CUE_LENGTH) : 0
    );
    const englishParts = english ? splitText(english, MAX_ENGLISH_CAPTION_CUE_LENGTH, partCount) : [];
    const chineseParts = chinese ? splitText(chinese, MAX_CHINESE_CAPTION_CUE_LENGTH, partCount) : [];
    const duration = Math.max(0, end - start);
    const weights = Array.from({ length: partCount }, (_, index) =>
        estimatedSpeechWeight(englishParts[index] ?? chineseParts[index] ?? '')
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let elapsed = start;
    return Array.from({ length: partCount }, (_, index) => {
        const cueEnd = index === partCount - 1 ? end : elapsed + duration * (weights[index] / totalWeight);
        const cue = {
            id: `${cuePrefix}_${index + 1}`,
            startMs: Math.round(elapsed * 1000),
            endMs: Math.round(cueEnd * 1000),
            ...(englishParts[index] ? { english: englishParts[index] } : {}),
            ...(chineseParts[index] ? { chinese: chineseParts[index] } : {})
        };
        elapsed = cueEnd;
        return cue;
    }).filter((cue) => cue.english || cue.chinese);
}

export function alignDialogueCaptions(
    prompt: string,
    transcript: readonly CaptionSegment[],
    mode: 'en-US' | 'zh-CN' | 'bilingual-en-zh',
    voiceLanguage: VoiceLanguage
) {
    const beats = extractDialogueBeats(prompt);
    const pieces = transcriptPieces(transcript);
    const spokenKey = voiceLanguage === 'zh-CN' ? 'chinese' : 'english';
    const expected = beats.filter((beat) => beat[spokenKey]);
    const cues: CaptionCue[] = [];
    let cursor = 0;
    let matchedDialogueCount = 0;

    for (const beat of expected) {
        const target = normalizedSpeech(beat[spokenKey] ?? '');
        let best: { score: number; start: number; end: number } | undefined;
        for (let start = cursor; start < Math.min(pieces.length, cursor + 4); start += 1) {
            for (let count = 1; count <= 8 && start + count <= pieces.length; count += 1) {
                const combined = pieces
                    .slice(start, start + count)
                    .map((piece) => piece.normalized)
                    .join('');
                const score = similarity(target, combined);
                if (!best || score > best.score) best = { score, start, end: start + count };
            }
        }
        if (!best || best.score < 0.42) continue;
        const first = pieces[best.start];
        const last = pieces[best.end - 1];
        cues.push(...displayCues(beat, first.start, last.end, mode, `caption_${matchedDialogueCount + 1}`));
        cursor = best.end;
        matchedDialogueCount += 1;
    }

    return {
        cues,
        expectedDialogueCount: expected.length,
        matchedDialogueCount,
        transcriptSegmentCount: transcript.length
    };
}

export function timeScriptCaptions(
    prompt: string,
    mode: 'en-US' | 'zh-CN' | 'bilingual-en-zh',
    voiceLanguage: VoiceLanguage,
    durationSeconds: number
) {
    const beats = extractDialogueBeats(prompt);
    const spokenKey = voiceLanguage === 'zh-CN' ? 'chinese' : 'english';
    const spokenBeats = beats.filter((beat) => beat[spokenKey]);
    const expected = spokenBeats.length > 0 ? spokenBeats : beats.filter((beat) => beat.english || beat.chinese);
    const weights = expected.map((beat) =>
        estimatedSpeechWeight(beat[spokenKey] ?? beat.english ?? beat.chinese ?? '')
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const duration = Math.max(0.5, durationSeconds);
    const edgePadding = Math.min(0.25, duration * 0.04);
    const usableDuration = Math.max(0.25, duration - edgePadding * 2);
    const cues: CaptionCue[] = [];
    let cursor = edgePadding;

    expected.forEach((beat, index) => {
        const beatDuration = usableDuration * (weights[index] / Math.max(1, totalWeight));
        const end = index === expected.length - 1 ? duration - edgePadding : cursor + beatDuration;
        cues.push(...displayCues(beat, cursor, end, mode, `caption_${index + 1}`));
        cursor = end;
    });

    return {
        cues,
        expectedDialogueCount: expected.length,
        matchedDialogueCount: expected.length,
        transcriptSegmentCount: 0
    };
}

function srtTime(milliseconds: number) {
    const totalMs = Math.max(0, Math.round(milliseconds));
    const ms = totalMs % 1000;
    const totalSeconds = Math.floor(totalMs / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

export function captionCuesToSrt(cues: readonly CaptionCue[]) {
    const blocks = cues.map((cue, index) => {
        const text = [cue.english, cue.chinese].filter(Boolean).join('\n');
        return `${index + 1}\n${srtTime(cue.startMs)} --> ${srtTime(cue.endMs)}\n${text}`;
    });
    return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}
