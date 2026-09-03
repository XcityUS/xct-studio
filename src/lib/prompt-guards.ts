export const AVOID_GENERATED_CAPTIONS_PROMPT =
    'No subtitles, no captions, no on-screen text, no burned-in text overlays.';
const GENERATED_CAPTIONS_PROMPT_HEADER = 'Caption overlay instructions:';
const LANGUAGE_PROMPT_HEADER = 'Language instructions:';
const SUBTITLE_LAYOUT_PROMPT =
    'Subtitle pacing and styling: do not display the full transcript at once. Split long dialogue into short timed subtitle segments and show only the current segment. For bilingual subtitles, show at most one short English segment above its matching Chinese segment at any moment. Use a compact small subtitle font, keep subtitles within the bottom safe area, and keep at least one line-height of vertical spacing between stacked lines. If a segment would exceed the safe area, reduce the font size first, then wrap; subtitle lines must never overlap.';
export const MAX_GENERATED_CAPTIONS = 2;
export const NO_GENERATED_CAPTION_LANGUAGE = 'none';
export const DEFAULT_GENERATED_CAPTION_LANGUAGES = ['en-US', 'zh-CN'] as const;
export const SILENT_VOICE_LANGUAGE = 'silent';
export const DEFAULT_VOICE_LANGUAGE = 'en-US';
export const DEFAULT_CAPTION_MODE = 'bilingual-en-zh';

export const GENERATED_CAPTION_LANGUAGES = [
    { id: 'en-US', label: 'English (US)', promptLabel: 'American English' },
    { id: 'zh-CN', label: 'Chinese', promptLabel: 'Chinese' },
    { id: 'ja-JP', label: 'Japanese', promptLabel: 'Japanese' },
    { id: 'ko-KR', label: 'Korean', promptLabel: 'Korean' },
    { id: 'es-ES', label: 'Spanish', promptLabel: 'Spanish' },
    { id: 'fr-FR', label: 'French', promptLabel: 'French' },
    { id: 'de-DE', label: 'German', promptLabel: 'German' },
    { id: 'pt-BR', label: 'Portuguese', promptLabel: 'Portuguese' },
    { id: 'it-IT', label: 'Italian', promptLabel: 'Italian' },
    { id: 'ar-SA', label: 'Arabic', promptLabel: 'Arabic' }
] as const;

export type GeneratedCaptionLanguage = (typeof GENERATED_CAPTION_LANGUAGES)[number]['id'];
export type VoiceLanguage = GeneratedCaptionLanguage | typeof SILENT_VOICE_LANGUAGE;
export type CaptionMode = 'none' | 'en-US' | 'zh-CN' | typeof DEFAULT_CAPTION_MODE;
export type GeneratedCaptionItem = {
    text: string;
    language: GeneratedCaptionLanguage;
};

export const VOICE_LANGUAGE_OPTIONS = [
    { id: SILENT_VOICE_LANGUAGE, label: 'Silent', promptLabel: 'no spoken dialogue or voiceover' },
    ...GENERATED_CAPTION_LANGUAGES
] as const;

export const CAPTION_MODE_OPTIONS = [
    { id: 'none', label: 'None' },
    { id: 'en-US', label: 'English' },
    { id: 'zh-CN', label: 'Chinese' },
    { id: DEFAULT_CAPTION_MODE, label: 'English + Chinese' }
] as const;

export function isGeneratedCaptionLanguage(value: string): value is GeneratedCaptionLanguage {
    return GENERATED_CAPTION_LANGUAGES.some((language) => language.id === value);
}

export function normalizeVoiceLanguage(value: string | undefined): VoiceLanguage {
    if (value === SILENT_VOICE_LANGUAGE) return value;
    return value && isGeneratedCaptionLanguage(value) ? value : DEFAULT_VOICE_LANGUAGE;
}

export function normalizeCaptionMode(value: string | undefined): CaptionMode {
    return value === 'none' || value === 'en-US' || value === 'zh-CN' || value === DEFAULT_CAPTION_MODE
        ? value
        : DEFAULT_CAPTION_MODE;
}

export function normalizeGeneratedCaptionLanguages(languages: readonly string[] | undefined): string[] {
    const seen = new Set<string>();
    return Array.from({ length: MAX_GENERATED_CAPTIONS }, (_, index) => {
        const raw = languages?.[index];
        const fallback = DEFAULT_GENERATED_CAPTION_LANGUAGES[index] ?? NO_GENERATED_CAPTION_LANGUAGE;
        const next = raw === NO_GENERATED_CAPTION_LANGUAGE || (raw && isGeneratedCaptionLanguage(raw)) ? raw : fallback;
        if (next === NO_GENERATED_CAPTION_LANGUAGE || seen.has(next)) return NO_GENERATED_CAPTION_LANGUAGE;
        seen.add(next);
        return next;
    });
}

export function normalizeGeneratedCaptionTexts(captions: readonly string[] | undefined): string[] {
    return (captions ?? [])
        .map((caption) => caption.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .slice(0, MAX_GENERATED_CAPTIONS);
}

export function normalizeGeneratedCaptionItems(
    captions: readonly string[] | undefined,
    languages?: readonly string[]
): GeneratedCaptionItem[] {
    const normalizedLanguages = normalizeGeneratedCaptionLanguages(languages);
    const usedLanguages = new Set<string>();
    const items: GeneratedCaptionItem[] = [];
    for (let index = 0; index < MAX_GENERATED_CAPTIONS; index++) {
        const language = normalizedLanguages[index];
        if (!language || language === NO_GENERATED_CAPTION_LANGUAGE || usedLanguages.has(language)) continue;
        if (!isGeneratedCaptionLanguage(language)) continue;
        const text = captions?.[index]?.trim().replace(/\s+/g, ' ');
        if (!text) continue;
        usedLanguages.add(language);
        items.push({ text, language });
    }
    return items;
}

function stripCaptionDirective(prompt: string): string {
    const marker = `\n${GENERATED_CAPTIONS_PROMPT_HEADER}`;
    const markerIndex = prompt.indexOf(marker);
    const languageMarker = `\n${LANGUAGE_PROMPT_HEADER}`;
    const languageMarkerIndex = prompt.indexOf(languageMarker);
    const firstMarkerIndex = [markerIndex, languageMarkerIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    if (firstMarkerIndex !== undefined) return prompt.slice(0, firstMarkerIndex).trimEnd();
    if (prompt.startsWith(GENERATED_CAPTIONS_PROMPT_HEADER) || prompt.startsWith(LANGUAGE_PROMPT_HEADER)) return '';
    return prompt.trimEnd();
}

export function promptWithCaptionGuard(prompt: string): string {
    const trimmed = stripCaptionDirective(prompt);
    if (!trimmed) return AVOID_GENERATED_CAPTIONS_PROMPT;
    return trimmed.toLowerCase().includes(AVOID_GENERATED_CAPTIONS_PROMPT.toLowerCase())
        ? trimmed
        : `${trimmed}\n${AVOID_GENERATED_CAPTIONS_PROMPT}`;
}

export function promptWithGeneratedCaptions(
    prompt: string,
    captions: readonly string[],
    languages?: readonly string[]
): string {
    const captionItems = normalizeGeneratedCaptionItems(captions, languages);
    const trimmed = stripCaptionDirective(prompt)
        .replace(new RegExp(`\\n?${AVOID_GENERATED_CAPTIONS_PROMPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
        .trimEnd();
    if (captionItems.length === 0) return promptWithCaptionGuard(trimmed);

    const captionLines = captionItems.map((caption, index) => {
        const language = GENERATED_CAPTION_LANGUAGES.find((item) => item.id === caption.language);
        return `${index + 1}. ${language?.promptLabel ?? 'Subtitle'}: "${caption.text.replace(/"/g, "'")}"`;
    });
    const activeLanguageLabels = captionItems
        .map((caption) => GENERATED_CAPTION_LANGUAGES.find((item) => item.id === caption.language)?.promptLabel)
        .filter(Boolean);
    const directive = [
        GENERATED_CAPTIONS_PROMPT_HEADER,
        ...captionLines,
        'Use natural American English for spoken dialogue by default.',
        activeLanguageLabels.length > 1
            ? `Render subtitles only from the lines above, stacked in this order from top to bottom: ${activeLanguageLabels.join(', ')}.`
            : 'Render only the subtitle line above.',
        SUBTITLE_LAYOUT_PROMPT
    ].join('\n');

    return trimmed ? `${trimmed}\n${directive}` : directive;
}

export function promptWithLanguageControls(
    prompt: string,
    options: { voiceLanguage?: string; captionMode?: string }
): string {
    const voiceLanguage = normalizeVoiceLanguage(options.voiceLanguage);
    const captionMode = normalizeCaptionMode(options.captionMode);
    const trimmed = stripCaptionDirective(prompt)
        .replace(new RegExp(`\\n?${AVOID_GENERATED_CAPTIONS_PROMPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
        .trimEnd();
    const voice = VOICE_LANGUAGE_OPTIONS.find((item) => item.id === voiceLanguage);
    const lines = [
        LANGUAGE_PROMPT_HEADER,
        voiceLanguage === SILENT_VOICE_LANGUAGE
            ? 'Audio: no spoken dialogue, no voiceover, no generated speech.'
            : `Audio: use natural ${voice?.promptLabel ?? 'American English'} for spoken dialogue by default.`
    ];

    if (captionMode === 'none') {
        lines.push('Subtitles: no subtitles, no captions, no on-screen subtitle text.');
    } else if (captionMode === DEFAULT_CAPTION_MODE) {
        lines.push(
            'Subtitles: render bilingual subtitles from the dialogue, English on the upper subtitle line and Chinese directly below it.'
        );
        lines.push(SUBTITLE_LAYOUT_PROMPT);
    } else {
        const captionLanguage = GENERATED_CAPTION_LANGUAGES.find((item) => item.id === captionMode);
        lines.push(`Subtitles: render ${captionLanguage?.promptLabel ?? 'subtitle'} subtitles from the dialogue.`);
        lines.push(SUBTITLE_LAYOUT_PROMPT);
    }

    const directive = lines.join('\n');
    return trimmed ? `${trimmed}\n${directive}` : directive;
}
