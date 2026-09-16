import { burnCaptionsIntoVideo } from '../assembly/client';
import { alignDialogueCaptions, captionCuesToSrt, timeScriptCaptions } from './alignment';
import type { VoiceLanguage } from '@/features/script/prompt/guards';
import type { CaptionSegment } from '@/lib/captions';
import type { CaptionTrack } from '@/shared/contracts/video';

type Options = {
    mode: CaptionTrack['mode'];
    delivery: CaptionTrack['delivery'];
    prompt: string;
    voiceLanguage: VoiceLanguage;
    transcribe: (film: Blob) => Promise<CaptionSegment[]>;
};

type ScriptOptions = Omit<Options, 'delivery' | 'transcribe'> & {
    durationSeconds: number;
};

export function renderScriptCaptions(film: Blob, options: ScriptOptions) {
    return { film, track: createScriptCaptionTrack(options) };
}

export function createScriptCaptionTrack(
    options: ScriptOptions,
    delivery: CaptionTrack['delivery'] = 'player'
): CaptionTrack {
    const timing = timeScriptCaptions(options.prompt, options.mode, options.voiceLanguage, options.durationSeconds);
    const warning = timing.cues.length ? undefined : 'No dialogue lines were found in the source script.';
    return {
        mode: options.mode,
        delivery,
        status: warning ? 'failed' : 'completed',
        source: 'script-timed',
        ...timing,
        ...(warning ? { warning } : {})
    };
}

export async function renderScriptBurnedCaptions(film: Blob, options: ScriptOptions) {
    const track = createScriptCaptionTrack(options, 'burned');
    if (track.status !== 'completed') return { film, track };

    try {
        const output = await burnCaptionsIntoVideo(film, { srt: captionCuesToSrt(track.cues) });
        return { film: output, track };
    } catch (error) {
        return {
            film,
            track: {
                ...track,
                status: 'failed' as const,
                warning: error instanceof Error ? error.message : 'Unknown caption burn-in error.'
            }
        };
    }
}

export async function renderAlignedCaptions(film: Blob, options: Options) {
    let counts = { expectedDialogueCount: 0, matchedDialogueCount: 0, transcriptSegmentCount: 0 };
    try {
        const transcript = await options.transcribe(film);
        const alignment = alignDialogueCaptions(options.prompt, transcript, options.mode, options.voiceLanguage);
        counts = alignment;
        if (!alignment.cues.length) throw new Error('No generated speech matched the source dialogue.');
        const output =
            options.delivery === 'burned'
                ? await burnCaptionsIntoVideo(film, { srt: captionCuesToSrt(alignment.cues) })
                : film;
        const warning =
            alignment.matchedDialogueCount < alignment.expectedDialogueCount
                ? `${alignment.matchedDialogueCount} of ${alignment.expectedDialogueCount} spoken lines matched.`
                : undefined;
        const track: CaptionTrack = {
            mode: options.mode,
            delivery: options.delivery,
            status: 'completed',
            source: 'transcription-aligned-script',
            ...alignment,
            ...(warning ? { warning } : {})
        };
        return { film: output, track };
    } catch (error) {
        const warning = error instanceof Error ? error.message : 'Unknown caption error.';
        const track: CaptionTrack = {
            mode: options.mode,
            delivery: options.delivery,
            status: 'failed',
            source: 'transcription-aligned-script',
            cues: [],
            ...counts,
            warning
        };
        return { film, track };
    }
}
