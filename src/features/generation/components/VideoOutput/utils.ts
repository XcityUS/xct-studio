import { createScriptCaptionTrack } from '@/features/post-production/captions/process';
import { captionDelivery, captionLanguage, normalizeVoiceLanguage } from '@/features/script/prompt/guards';
import type { VideoMetadata } from '@/shared/contracts/video';

export function captionTrackForOutput(item?: VideoMetadata) {
    const storedTrack = item?.captionTrack;
    const language = captionLanguage(item?.createParams?.caption_mode);
    const shouldRebuild =
        (!storedTrack || (storedTrack.source === 'script-timed' && storedTrack.delivery === 'player')) &&
        item?.status === 'completed' &&
        language &&
        captionDelivery(item.createParams?.caption_mode) === 'player';
    if (!shouldRebuild) return storedTrack;
    return createScriptCaptionTrack({
        mode: language,
        prompt: item.createParams?.caption_source_prompt ?? item.createParams?.prompt ?? item.prompt,
        voiceLanguage: normalizeVoiceLanguage(item.createParams?.voice_language),
        durationSeconds: item.seconds
    });
}
