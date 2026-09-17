import { shouldGenerateAudio } from './reference-audio';
import { appendProjectReferenceUrls } from './shot-queue';
import type { CreationFormData, SingleImageMode } from './types';
import type { AudioRange } from '@/features/generation/reference-audio/range';
import { normalizeCaptionMode, shouldAvoidGeneratedCaptions } from '@/features/script/prompt/guards';
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
    singleImageMode: SingleImageMode;
    lastFrameUrl: string;
    referenceAudioUrl: string;
    referenceAudioRange?: AudioRange;
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
        const captionMode = normalizeCaptionMode(context.captionMode);
        const data: CreationFormData = {
            model: context.model,
            prompt: nextPrompt,
            ratio: context.ratio,
            resolution: context.resolution,
            seconds: clampSeconds(nextSeconds, context.model),
            generate_audio: shouldGenerateAudio(
                context.voiceLanguage,
                context.referenceAudioUrl,
                context.showReferenceAudio
            ),
            camera_fixed: context.cameraFixed,
            seed: context.seed,
            watermark: context.watermark,
            watermarkText: context.watermark ? context.watermarkText.trim().slice(0, 100) : undefined,
            avoid_generated_captions: shouldAvoidGeneratedCaptions(captionMode),
            voice_language: context.voiceLanguage,
            caption_mode: captionMode,
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
        if (
            refs.length === 1 &&
            !forceReferenceImageMode &&
            (context.referenceCap <= 1 || context.singleImageMode === 'first-frame')
        ) {
            data.input_reference_url = refs[0];
            if (context.lastFrameUrl.trim()) data.last_frame_url = context.lastFrameUrl.trim();
        } else if (refs.length > 1) {
            data.reference_image_urls = refs;
        } else if (refs.length === 1) {
            data.reference_image_urls = refs;
        }
        if (!data.input_reference_url && context.showReferenceAudio && context.referenceAudioUrl.trim()) {
            data.reference_audio_url = context.referenceAudioUrl.trim();
            const range = context.referenceAudioRange ?? { startSeconds: 0, endSeconds: data.seconds };
            data.reference_audio_range = {
                startSeconds: range.startSeconds,
                endSeconds: Math.min(range.endSeconds, range.startSeconds + data.seconds)
            };
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
