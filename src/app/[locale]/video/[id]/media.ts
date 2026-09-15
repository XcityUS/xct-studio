import {
    alignDialogueCaptions,
    captionCuesToSrt,
    timeScriptCaptions
} from '@/features/post-production/captions/alignment';
import { captionDelivery, captionLanguage, normalizeVoiceLanguage } from '@/features/script/prompt/guards';
import type { CaptionSegment } from '@/lib/captions';

type SharedMediaRecord = {
    id?: string;
    prompt: string;
    params: Record<string, unknown>;
};

const CURATED_SHARED_TRANSCRIPTS: Readonly<Record<string, readonly CaptionSegment[]>> = {
    i26p6dkw: [
        {
            start: 0,
            end: 3.62,
            text: 'Excuse me. Do you mind if I ask some things about work for this company?'
        },
        { start: 3.62, end: 5.1, text: 'Not at all. Go ahead.' },
        {
            start: 5.1,
            end: 8.6,
            text: "I've heard that the company is very strict with its staff. Is that true?"
        },
        { start: 8.6, end: 11.42, text: 'Not really, so long as you follow all the regulations.' },
        { start: 11.42, end: 14.04, text: "If you make mistakes in your job, you'll be fired. Is it right?" },
        {
            start: 14.04,
            end: 18.02,
            text: 'No. Everyone has a chance to correct his or her mistakes. The most important thing is to be responsible for your work.'
        },
        { start: 18.02, end: 19.76, text: 'Working here involves a busy schedule and overtime. Is that true?' },
        {
            start: 19.76,
            end: 25.62,
            text: "Yes. That's true. We are always busy. The company attaches great importance to high efficiency. Sometimes we have to work overtime, but not always. And we have extra pay for extra work."
        },
        {
            start: 25.62,
            end: 29.94,
            text: 'It seems that working in a foreign enterprise is not the same as I expected. Thank you for your help.'
        }
    ]
};

function transcriptSegments(record: SharedMediaRecord) {
    const stored = record.params.caption_segments;
    if (Array.isArray(stored)) {
        const parsed = stored.flatMap((segment): CaptionSegment[] => {
            if (!segment || typeof segment !== 'object' || Array.isArray(segment)) return [];
            const candidate = segment as Record<string, unknown>;
            return typeof candidate.start === 'number' &&
                Number.isFinite(candidate.start) &&
                typeof candidate.end === 'number' &&
                Number.isFinite(candidate.end) &&
                candidate.end > candidate.start &&
                typeof candidate.text === 'string' &&
                candidate.text.trim()
                ? [{ start: candidate.start, end: candidate.end, text: candidate.text.trim() }]
                : [];
        });
        if (parsed.length > 0) return parsed;
    }
    return record.id ? CURATED_SHARED_TRANSCRIPTS[record.id] : undefined;
}

export function shareAspectRatio(size: string) {
    const match = size.match(/(\d+)\s*[:xX]\s*(\d+)/);
    if (!match) return '16 / 9';

    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return '16 / 9';
    return `${width} / ${height}`;
}

export function createSharedSubtitle(record: SharedMediaRecord) {
    const rawMode = typeof record.params.caption_mode === 'string' ? record.params.caption_mode : undefined;
    if (!rawMode) return undefined;
    const language = captionLanguage(rawMode);
    if (!language || captionDelivery(rawMode) !== 'player') return undefined;

    const sourcePrompt =
        typeof record.params.caption_source_prompt === 'string' ? record.params.caption_source_prompt : record.prompt;
    const rawSeconds = record.params.seconds;
    const seconds =
        typeof rawSeconds === 'number' ? rawSeconds : typeof rawSeconds === 'string' ? Number(rawSeconds) : 5;
    const voiceLanguage = normalizeVoiceLanguage(
        typeof record.params.voice_language === 'string' ? record.params.voice_language : undefined
    );
    const transcript = transcriptSegments(record);
    const cues = transcript?.length
        ? alignDialogueCaptions(sourcePrompt, transcript, language, voiceLanguage).cues
        : timeScriptCaptions(sourcePrompt, language, voiceLanguage, Number.isFinite(seconds) ? seconds : 5).cues;
    const srt = captionCuesToSrt(cues);
    return srt
        ? {
              url: `data:text/plain;charset=utf-8,${encodeURIComponent(srt)}`,
              type: 'srt' as const
          }
        : undefined;
}
