import { BRANDING_WATERMARK_TEXT, SHARE_PROMPT_LIMIT } from './constants';
import { isRecord, isVideoJobCreateParams, isVideoRatio, isVideoResolution, normalizeWatermarkText } from './utils';
import { reconcilePreset } from '@/features/community/gallery/preset';
import { type CreationFormData } from '@/features/generation/components/CreationForm';
import {
    DEFAULT_VOICE_LANGUAGE,
    SILENT_VOICE_LANGUAGE,
    cleanPromptForReuse,
    normalizeCaptionMode,
    normalizeTitleOverlayDuration,
    normalizeTitleOverlayLanguage,
    normalizeTitleOverlayStyle,
    normalizeTitleOverlayText,
    normalizeVoiceLanguage,
    shouldAvoidGeneratedCaptions
} from '@/features/script/prompt/guards';
import {
    DEFAULT_MODEL,
    DEFAULT_RATIO,
    DEFAULT_RESOLUTION,
    DEFAULT_SECONDS,
    clampSeconds,
    getSeedanceModel,
    modelSupportsResolution,
    type VideoModel
} from '@/shared/config/seedance';
import type { VideoMetadata } from '@/shared/contracts/video';

export function shareTitleFromPrompt(prompt: string): string {
    const title = prompt.trim().replace(/\s+/g, ' ');
    if (!title) return 'Xcity Studio video';
    return title.length > 120 ? `${title.slice(0, 117)}...` : title;
}

export function sharePromptWithinLimit(prompt: string): string {
    const normalized = prompt.trim();
    return normalized.length > SHARE_PROMPT_LIMIT ? normalized.slice(0, SHARE_PROMPT_LIMIT) : normalized;
}

export function shareTitleFromItem(item: VideoMetadata): string {
    const title = item.title?.trim();
    return title
        ? title.length > 120
            ? `${title.slice(0, 117)}...`
            : title
        : shareTitleFromPrompt(cleanPromptForReuse(item.prompt));
}

export function captionModeFromLanguages(languages: readonly string[] | undefined): string | undefined {
    const active = new Set((languages ?? []).filter((language) => language === 'en-US' || language === 'zh-CN'));
    if (active.has('en-US') && active.has('zh-CN')) return 'auto-bilingual-en-zh';
    if (active.has('en-US')) return 'auto-en-US';
    if (active.has('zh-CN')) return 'auto-zh-CN';
    return undefined;
}

export function shareParamsToForm(prompt: string, params: unknown): { params: CreationFormData; adjusted: string[] } {
    const reusablePrompt = cleanPromptForReuse(prompt);
    if (isVideoJobCreateParams(params)) {
        const captionSourcePrompt = cleanPromptForReuse(params.caption_source_prompt ?? reusablePrompt);
        const reconciled = reconcilePreset({ ...params, prompt: captionSourcePrompt });
        const captionMode = normalizeCaptionMode(
            reconciled.caption_mode ?? captionModeFromLanguages(reconciled.generated_caption_languages)
        );
        const titleOverlayText = normalizeTitleOverlayText(reconciled.title_overlay_text);
        const titleOverlayEnabled = reconciled.title_overlay_enabled === true && Boolean(titleOverlayText);
        return {
            params: {
                ...reconciled,
                voice_language: normalizeVoiceLanguage(
                    reconciled.voice_language ??
                        (reconciled.generate_audio ? DEFAULT_VOICE_LANGUAGE : SILENT_VOICE_LANGUAGE)
                ),
                caption_mode: captionMode,
                caption_source_prompt: captionSourcePrompt,
                avoid_generated_captions: shouldAvoidGeneratedCaptions(captionMode),
                generated_captions: undefined,
                generated_caption_languages: undefined,
                title_overlay_enabled: titleOverlayEnabled,
                title_overlay_text: titleOverlayEnabled ? titleOverlayText : undefined,
                title_overlay_style: normalizeTitleOverlayStyle(reconciled.title_overlay_style),
                title_overlay_duration: normalizeTitleOverlayDuration(reconciled.title_overlay_duration),
                title_overlay_language: normalizeTitleOverlayLanguage(reconciled.title_overlay_language)
            },
            adjusted: reconciled.adjusted
        };
    }

    const record = isRecord(params) ? params : {};
    const captionSourcePrompt = cleanPromptForReuse(
        typeof record.caption_source_prompt === 'string' ? record.caption_source_prompt : reusablePrompt
    );
    const model =
        typeof record.model === 'string' && getSeedanceModel(record.model)
            ? (record.model as VideoModel)
            : DEFAULT_MODEL;
    const ratio = typeof record.ratio === 'string' && isVideoRatio(record.ratio) ? record.ratio : DEFAULT_RATIO;
    const requestedResolution =
        typeof record.resolution === 'string' && isVideoResolution(record.resolution)
            ? record.resolution
            : DEFAULT_RESOLUTION;
    const resolution = modelSupportsResolution(model, requestedResolution) ? requestedResolution : DEFAULT_RESOLUTION;
    const rawSeconds =
        typeof record.seconds === 'number'
            ? record.seconds
            : typeof record.seconds === 'string'
              ? Number(record.seconds)
              : DEFAULT_SECONDS;
    const seconds = clampSeconds(rawSeconds, model);
    const seed = typeof record.seed === 'number' && Number.isFinite(record.seed) ? Math.trunc(record.seed) : undefined;
    const rawGeneratedCaptionLanguages = Array.isArray(record.generated_caption_languages)
        ? record.generated_caption_languages.filter((language): language is string => typeof language === 'string')
        : [];
    const captionMode = normalizeCaptionMode(
        typeof record.caption_mode === 'string'
            ? record.caption_mode
            : captionModeFromLanguages(rawGeneratedCaptionLanguages)
    );
    const titleOverlayText = normalizeTitleOverlayText(
        typeof record.title_overlay_text === 'string' ? record.title_overlay_text : undefined
    );
    const titleOverlayEnabled = record.title_overlay_enabled === true && Boolean(titleOverlayText);
    const generateAudio = typeof record.generate_audio === 'boolean' ? record.generate_audio : true;
    const adjusted = [
        resolution !== requestedResolution ? `resolution → ${resolution}` : '',
        seconds !== rawSeconds ? `duration → ${seconds}s` : ''
    ].filter(Boolean);

    return {
        params: {
            model,
            prompt: captionSourcePrompt,
            ratio,
            resolution,
            seconds,
            generate_audio: generateAudio,
            camera_fixed: typeof record.camera_fixed === 'boolean' ? record.camera_fixed : false,
            seed,
            watermark: typeof record.watermark === 'boolean' ? record.watermark : false,
            watermarkText:
                typeof record.watermarkText === 'string'
                    ? normalizeWatermarkText(record.watermarkText)
                    : BRANDING_WATERMARK_TEXT,
            avoid_generated_captions: shouldAvoidGeneratedCaptions(captionMode),
            generated_captions: undefined,
            generated_caption_languages: undefined,
            voice_language: normalizeVoiceLanguage(
                typeof record.voice_language === 'string'
                    ? record.voice_language
                    : generateAudio
                      ? DEFAULT_VOICE_LANGUAGE
                      : SILENT_VOICE_LANGUAGE
            ),
            caption_mode: captionMode,
            caption_source_prompt: captionSourcePrompt,
            title_overlay_enabled: titleOverlayEnabled,
            title_overlay_text: titleOverlayEnabled ? titleOverlayText : undefined,
            title_overlay_style: normalizeTitleOverlayStyle(
                typeof record.title_overlay_style === 'string' ? record.title_overlay_style : undefined
            ),
            title_overlay_duration: normalizeTitleOverlayDuration(
                typeof record.title_overlay_duration === 'string' ? record.title_overlay_duration : undefined
            ),
            title_overlay_language: normalizeTitleOverlayLanguage(
                typeof record.title_overlay_language === 'string' ? record.title_overlay_language : undefined
            )
        },
        adjusted
    };
}
