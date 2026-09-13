import { appendProjectReferenceUrls } from './shot-queue';
import type { CreationFormData } from './types';
import { SILENT_VOICE_LANGUAGE } from '@/features/script/prompt/guards';
import { clampSeconds, type VideoModel, type VideoRatio, type VideoResolution } from '@/shared/config/seedance';
import type { ProductionSnapshot } from '@/shared/contracts/production';

type ProductionShot = {
    id: string;
    index: number;
    count: number;
    durationSeconds: number;
    assetIds?: string[];
};

type Context = {
    prompt: string;
    seconds: number;
    model: VideoModel;
    ratio: VideoRatio;
    resolution: VideoResolution;
    finalResolution: VideoResolution;
    draft: boolean;
    voiceLanguage: string;
    captionMode: string;
    cameraFixed: boolean;
    seed?: number;
    watermark: boolean;
    watermarkText: string;
    titleOverlayEnabled: boolean;
    titleOverlayText: string;
    titleOverlayStyle: string;
    titleOverlayDuration: string;
    titleOverlayLanguage: string;
    referenceUrls: string[];
    referenceCap: number;
    lastFrameUrl: string;
    referenceAudioUrl: string;
    showReferenceAudio: boolean;
    referenceVideoUrls: string[];
    referenceVideoSecondsByUrl: Record<string, number>;
    showReferenceVideos: boolean;
    buildProductionSnapshot?: (shot?: ProductionShot) => ProductionSnapshot;
};

export function createSubmissionBuilder(context: Context) {
    return (
        nextPrompt = context.prompt,
        nextSeconds = context.seconds,
        productionShot?: ProductionShot
    ): CreationFormData => {
        const production = context.buildProductionSnapshot?.(productionShot);
        const data: CreationFormData = {
            model: context.model,
            prompt: nextPrompt,
            ratio: context.ratio,
            resolution: context.resolution,
            seconds: clampSeconds(nextSeconds, context.model),
            generate_audio: context.voiceLanguage !== SILENT_VOICE_LANGUAGE,
            camera_fixed: context.cameraFixed,
            seed: context.seed,
            watermark: context.watermark,
            watermarkText: context.watermark ? context.watermarkText.trim().slice(0, 100) : undefined,
            avoid_generated_captions: context.captionMode === 'none',
            voice_language: context.voiceLanguage,
            caption_mode: context.captionMode,
            title_overlay_enabled: context.titleOverlayEnabled && Boolean(context.titleOverlayText),
            title_overlay_text: context.titleOverlayEnabled ? context.titleOverlayText : undefined,
            title_overlay_style: context.titleOverlayEnabled ? context.titleOverlayStyle : undefined,
            title_overlay_duration: context.titleOverlayEnabled ? context.titleOverlayDuration : undefined,
            title_overlay_language: context.titleOverlayEnabled ? context.titleOverlayLanguage : undefined,
            ...(production ? { production } : {})
        };
        if (context.draft) {
            data.draft = true;
            data.final_resolution = context.finalResolution;
        }
        const refs = appendProjectReferenceUrls(context.referenceUrls, production, context.referenceCap);
        const forceReferenceImageMode = Boolean(productionShot || production?.shot);
        const videos = context.showReferenceVideos
            ? context.referenceVideoUrls.map((url) => url.trim()).filter(Boolean)
            : [];
        if (refs.length === 1 && !forceReferenceImageMode) {
            data.input_reference_url = refs[0];
            if (context.lastFrameUrl.trim()) data.last_frame_url = context.lastFrameUrl.trim();
        } else if (refs.length > 1) {
            data.reference_image_urls = refs;
            if (context.showReferenceAudio && context.referenceAudioUrl.trim()) {
                data.reference_audio_url = context.referenceAudioUrl.trim();
            }
        } else if (refs.length === 1) {
            data.reference_image_urls = refs;
        }
        if (videos.length) {
            data.reference_video_urls = videos.slice(0, 2);
            data.reference_video_seconds = data.reference_video_urls.map(
                (url) => context.referenceVideoSecondsByUrl[url] ?? 0
            );
            if (refs.length === 1) {
                data.omni_reference_task_type = 'extend';
                data.omit_resolution = true;
                data.omit_ratio = true;
                data.camera_fixed = undefined;
            }
        }
        return data;
    };
}
