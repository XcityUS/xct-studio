export const AVOID_GENERATED_CAPTIONS_PROMPT =
    'No subtitles, no captions, no on-screen text, no burned-in text overlays.';
const GENERATED_CAPTIONS_PROMPT_HEADER = 'Caption overlay instructions:';
export const MAX_GENERATED_CAPTIONS = 2;
export const NO_GENERATED_CAPTION_LANGUAGE = 'none';
export const DEFAULT_GENERATED_CAPTION_LANGUAGES = ['en-US', 'zh-CN'] as const;

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
export type GeneratedCaptionItem = {
    text: string;
    language: GeneratedCaptionLanguage;
};

export function isGeneratedCaptionLanguage(value: string): value is GeneratedCaptionLanguage {
    return GENERATED_CAPTION_LANGUAGES.some((language) => language.id === value);
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
    if (markerIndex >= 0) return prompt.slice(0, markerIndex).trimEnd();
    return prompt.startsWith(GENERATED_CAPTIONS_PROMPT_HEADER) ? '' : prompt.trimEnd();
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
        'Keep subtitle lines inside the lower safe area with clear vertical spacing. If the text is long, wrap it or reduce the font size so subtitle lines never overlap.'
    ].join('\n');

    return trimmed ? `${trimmed}\n${directive}` : directive;
}
