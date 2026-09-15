import {
    CAPTION_MODE_OPTIONS,
    TITLE_OVERLAY_DURATIONS,
    TITLE_OVERLAY_LANGUAGES,
    TITLE_OVERLAY_STYLES,
    VOICE_LANGUAGE_OPTIONS
} from '@/features/script/prompt/guards';
import { RATIOS, SEEDANCE_MODELS, type VideoModel } from '@/shared/config/seedance';
import { useTranslations } from 'next-intl';

export function useCreationOptions() {
    const t = useTranslations();
    const modelDescriptions: Record<VideoModel, string> = {
        'seedance-1-5-pro-251215': t('Native audio <mdash> best value'),
        'dreamina-seedance-2-0-260128': t('High quality <mdash> audio'),
        'dreamina-seedance-2-0-fast-260128': t('Faster <mdash> no 1080p'),
        'dreamina-seedance-2-5-260628': t('Up to 30s single shot')
    };
    const voiceLabels = {
        silent: t('Silent'),
        'en-US': t('English <lpar>US<rpar>'),
        'zh-CN': t('Chinese'),
        'ja-JP': t('Japanese'),
        'ko-KR': t('Korean'),
        'es-ES': t('Spanish'),
        'fr-FR': t('French'),
        'de-DE': t('German'),
        'pt-BR': t('Portuguese'),
        'it-IT': t('Italian'),
        'ar-SA': t('Arabic')
    };

    return {
        models: SEEDANCE_MODELS.map((model) => ({
            value: model.id,
            label: `${model.label} · ${modelDescriptions[model.id]}`
        })),
        ratios: [
            { value: RATIOS[0], label: `${RATIOS[0]} · ${t('Landscape')}` },
            { value: RATIOS[1], label: `${RATIOS[1]} · ${t('Portrait')}` },
            { value: RATIOS[2], label: `${RATIOS[2]} · ${t('Square')}` },
            { value: RATIOS[3], label: `${RATIOS[3]} · ${t('Classic')}` },
            { value: RATIOS[4], label: `${RATIOS[4]} · ${t('Cinematic')}` }
        ],
        voices: VOICE_LANGUAGE_OPTIONS.map((voice) => ({ value: voice.id, label: voiceLabels[voice.id] })),
        titleStyles: [
            { value: TITLE_OVERLAY_STYLES[0].id, label: t('Cinematic') },
            { value: TITLE_OVERLAY_STYLES[1].id, label: t('Clean') },
            { value: TITLE_OVERLAY_STYLES[2].id, label: t('Bold') },
            { value: TITLE_OVERLAY_STYLES[3].id, label: t('Elegant') }
        ],
        titleLanguages: [
            { value: TITLE_OVERLAY_LANGUAGES[0].id, label: t('Auto') },
            { value: TITLE_OVERLAY_LANGUAGES[1].id, label: t('English') },
            { value: TITLE_OVERLAY_LANGUAGES[2].id, label: t('Chinese') }
        ],
        titleDurations: [
            { value: TITLE_OVERLAY_DURATIONS[0].id, label: t('First frame') },
            { value: TITLE_OVERLAY_DURATIONS[1].id, label: t('First 1s') },
            { value: TITLE_OVERLAY_DURATIONS[2].id, label: t('First 2s') }
        ],
        captions: [
            { value: CAPTION_MODE_OPTIONS[0].id, label: t('None') },
            { value: CAPTION_MODE_OPTIONS[1].id, label: t('Automatic subtitles <mdash> English') },
            { value: CAPTION_MODE_OPTIONS[2].id, label: t('Automatic subtitles <mdash> Chinese') },
            { value: CAPTION_MODE_OPTIONS[3].id, label: t('Automatic subtitles <mdash> English <plus> Chinese') },
            { value: CAPTION_MODE_OPTIONS[4].id, label: t('Burn in <mdash> English') },
            { value: CAPTION_MODE_OPTIONS[5].id, label: t('Burn in <mdash> Chinese') },
            { value: CAPTION_MODE_OPTIONS[6].id, label: t('Burn in <mdash> English <plus> Chinese') }
        ]
    };
}
