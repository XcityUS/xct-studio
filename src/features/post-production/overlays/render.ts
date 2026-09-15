import { burnTitleOverlayIntoVideo, type TitleOverlayOptions } from '../assembly/client';
import { renderScriptBurnedCaptions, renderScriptCaptions } from '../captions/process';
import {
    captionDelivery,
    captionLanguage,
    normalizeTitleOverlayText,
    normalizeVoiceLanguage
} from '@/features/script/prompt/guards';
import type { CaptionTrack, VideoJobCreate } from '@/shared/contracts/video';

export async function renderTextOverlays(
    film: Blob,
    params: VideoJobCreate | undefined,
    fallbackPrompt: string
) {
    let output = film;
    let titleApplied = false;
    let titleWarning: string | undefined;
    let captionTrack: CaptionTrack | undefined;
    const titleText = normalizeTitleOverlayText(params?.title_overlay_text);
    const title: TitleOverlayOptions | undefined =
        params?.title_overlay_enabled && titleText
            ? { text: titleText, style: params.title_overlay_style, duration: params.title_overlay_duration }
            : undefined;
    const selectedCaptionLanguage = captionLanguage(params?.caption_mode);
    const selectedCaptionDelivery = captionDelivery(params?.caption_mode);

    if (title) {
        try {
            output = await burnTitleOverlayIntoVideo(output, title);
            titleApplied = true;
        } catch (error) {
            titleWarning = error instanceof Error ? error.message : 'Unknown title overlay error.';
        }
    }
    if (selectedCaptionLanguage && selectedCaptionDelivery === 'player') {
        const result = renderScriptCaptions(output, {
            mode: selectedCaptionLanguage,
            prompt: params?.caption_source_prompt ?? params?.prompt ?? fallbackPrompt,
            voiceLanguage: normalizeVoiceLanguage(params?.voice_language),
            durationSeconds: params?.seconds ?? 5
        });
        captionTrack = result.track;
    } else if (selectedCaptionLanguage && selectedCaptionDelivery === 'burned') {
        const result = await renderScriptBurnedCaptions(output, {
            mode: selectedCaptionLanguage,
            prompt: params?.caption_source_prompt ?? params?.prompt ?? fallbackPrompt,
            voiceLanguage: normalizeVoiceLanguage(params?.voice_language),
            durationSeconds: params?.seconds ?? 5
        });
        output = result.film;
        captionTrack = result.track;
    }
    return { film: output, titleApplied, titleWarning, captionTrack };
}
