export const AVOID_GENERATED_CAPTIONS_PROMPT =
    'No subtitles, no captions, no on-screen text, no burned-in text overlays.';
const GENERATED_CAPTIONS_PROMPT_HEADER = 'Caption overlay instructions:';
const LANGUAGE_PROMPT_HEADER = 'Language instructions:';
const TITLE_OVERLAY_PROMPT_HEADER = 'Title overlay instructions:';
const PARAMETER_PRIORITY_PROMPT_HEADER = 'Priority parameter constraints:';
const CREATIVE_CONTENT_PROMPT_HEADER = 'Creative content:';
const FINAL_PARAMETER_LOCK_PROMPT_HEADER = 'Final parameter lock:';
const DIALOGUE_PACING_PROMPT =
    'Dialogue pacing: keep spoken lines short and sequential. Only one person may speak at a time; never overlap two voices or play simultaneous dialogue. Leave brief natural pauses between speakers. For clips under 8 seconds, use at most one short sentence per speaker, and prefer ambient sound over long narration.';
const REMOTE_DIALOGUE_PROMPT =
    'Remote dialogue staging: this reads as a phone call or remote conversation. Show every speaker consistently participating by phone or remote device; cut between both sides if needed, but do not stage one speaker as if they are physically face-to-face with the other.';
const SUBTITLE_LAYOUT_PROMPT =
    'Subtitle pacing and styling: do not display the full transcript at once. Split long dialogue into short timed subtitle segments and show only the current segment. If one subtitle segment is too long for the character limits, split it into two consecutive subtitle screens instead of fitting everything into one frame. Keep subtitles above the bottom safe area with generous bottom margin; never place subtitles on the very bottom edge, under letterbox bars, or where player controls would cover them. Never let subtitle lines overlap. Use compact small subtitle text with a dark outline or shadow for readability. English subtitles must use readable English words, not hashes or filenames. Chinese subtitles must use valid Simplified Chinese sentences, not mojibake, random Han characters, pinyin, Japanese kana, or mixed corrupted text.';
export const MAX_ENGLISH_SUBTITLE_LINE_LENGTH = 64;
export const MAX_CHINESE_SUBTITLE_LINE_LENGTH = 28;
const BILINGUAL_SUBTITLE_LAYOUT_PROMPT = `Bilingual subtitle layout: for every dialogue beat, render exactly two subtitle lines at the same time. The first line must be English. The second line directly below it must be concise Simplified Chinese. Do not reverse the order, do not show only one language, and do not split the two languages into different moments. Keep each English line within ${MAX_ENGLISH_SUBTITLE_LINE_LENGTH} characters and each Chinese line within ${MAX_CHINESE_SUBTITLE_LINE_LENGTH} Chinese characters; shorten the translation before shrinking below readable size.`;
export const MAX_GENERATED_CAPTIONS = 2;
export const NO_GENERATED_CAPTION_LANGUAGE = 'none';
export const DEFAULT_GENERATED_CAPTION_LANGUAGES = ['en-US', 'zh-CN'] as const;
export const SILENT_VOICE_LANGUAGE = 'silent';
export const DEFAULT_VOICE_LANGUAGE = 'en-US';
export const DEFAULT_CAPTION_MODE = 'auto-bilingual-en-zh';
export const MAX_TITLE_OVERLAY_TEXT_LENGTH = 80;
export const DEFAULT_TITLE_OVERLAY_STYLE = 'cinematic';
export const DEFAULT_TITLE_OVERLAY_DURATION = 'opening-1s';
export const DEFAULT_TITLE_OVERLAY_LANGUAGE = 'auto';

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
export type CaptionMode =
    | 'none'
    | 'auto-en-US'
    | 'auto-zh-CN'
    | typeof DEFAULT_CAPTION_MODE
    | 'burn-en-US'
    | 'burn-zh-CN'
    | 'burn-bilingual-en-zh';
export type GeneratedCaptionItem = {
    text: string;
    language: GeneratedCaptionLanguage;
};

export const TITLE_OVERLAY_STYLES = [
    { id: 'cinematic', label: 'Cinematic', promptLabel: 'cinematic title card typography' },
    { id: 'clean', label: 'Clean', promptLabel: 'clean modern sans-serif typography' },
    { id: 'bold', label: 'Bold', promptLabel: 'bold high-impact display typography' },
    { id: 'elegant', label: 'Elegant', promptLabel: 'elegant refined serif typography' }
] as const;

export const TITLE_OVERLAY_DURATIONS = [
    { id: 'first-frame', label: 'First frame', promptLabel: 'only on the opening frame' },
    { id: 'opening-1s', label: 'First 1s', promptLabel: 'only during the opening 1 second' },
    { id: 'opening-2s', label: 'First 2s', promptLabel: 'only during the opening 2 seconds' }
] as const;

export const TITLE_OVERLAY_LANGUAGES = [
    {
        id: 'auto',
        label: 'Auto',
        promptLabel: 'keep the title exactly in the language and wording provided by the user'
    },
    {
        id: 'en-US',
        label: 'English',
        promptLabel: 'render the title in English using the exact user-provided title text'
    },
    {
        id: 'zh-CN',
        label: 'Chinese',
        promptLabel: 'render the title in Chinese using the exact user-provided title text'
    }
] as const;

export type TitleOverlayStyle = (typeof TITLE_OVERLAY_STYLES)[number]['id'];
export type TitleOverlayDuration = (typeof TITLE_OVERLAY_DURATIONS)[number]['id'];
export type TitleOverlayLanguage = (typeof TITLE_OVERLAY_LANGUAGES)[number]['id'];

export const VOICE_LANGUAGE_OPTIONS = [
    { id: SILENT_VOICE_LANGUAGE, label: 'Silent', promptLabel: 'no spoken dialogue or voiceover' },
    ...GENERATED_CAPTION_LANGUAGES
] as const;

export const CAPTION_MODE_OPTIONS = [
    { id: 'none', label: 'None' },
    { id: 'auto-en-US', label: 'Automatic — English' },
    { id: 'auto-zh-CN', label: 'Automatic — Chinese' },
    { id: DEFAULT_CAPTION_MODE, label: 'Automatic — English + Chinese' },
    { id: 'burn-en-US', label: 'Burn in — English' },
    { id: 'burn-zh-CN', label: 'Burn in — Chinese' },
    { id: 'burn-bilingual-en-zh', label: 'Burn in — English + Chinese' }
] as const;

export function isGeneratedCaptionLanguage(value: string): value is GeneratedCaptionLanguage {
    return GENERATED_CAPTION_LANGUAGES.some((language) => language.id === value);
}

export function normalizeVoiceLanguage(value: string | undefined): VoiceLanguage {
    if (value === SILENT_VOICE_LANGUAGE) return value;
    return value && isGeneratedCaptionLanguage(value) ? value : DEFAULT_VOICE_LANGUAGE;
}

export function normalizeCaptionMode(value: string | undefined): CaptionMode {
    if (value === 'en-US') return 'auto-en-US';
    if (value === 'zh-CN') return 'auto-zh-CN';
    if (value === 'bilingual-en-zh') return DEFAULT_CAPTION_MODE;
    if (value === 'provider-auto') return 'auto-en-US';
    if (value === 'provider-bilingual-en-zh') return 'auto-bilingual-en-zh';
    return CAPTION_MODE_OPTIONS.some((option) => option.id === value) ? (value as CaptionMode) : DEFAULT_CAPTION_MODE;
}

export function captionLanguage(value: string | undefined): 'en-US' | 'zh-CN' | 'bilingual-en-zh' | undefined {
    const mode = normalizeCaptionMode(value);
    if (mode === 'auto-en-US' || mode === 'burn-en-US') return 'en-US';
    if (mode === 'auto-zh-CN' || mode === 'burn-zh-CN') return 'zh-CN';
    if (mode === DEFAULT_CAPTION_MODE || mode === 'burn-bilingual-en-zh') return 'bilingual-en-zh';
    return undefined;
}

export function captionDelivery(value: string | undefined): 'player' | 'burned' | undefined {
    const mode = normalizeCaptionMode(value);
    if (mode.startsWith('auto-')) return 'player';
    if (mode.startsWith('burn-')) return 'burned';
    return undefined;
}

export function shouldAvoidGeneratedCaptions(value: string | undefined) {
    return normalizeCaptionMode(value) === 'none';
}

export function normalizeTitleOverlayText(value: string | undefined): string {
    return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE_OVERLAY_TEXT_LENGTH);
}

export function normalizeTitleOverlayStyle(value: string | undefined): TitleOverlayStyle {
    return TITLE_OVERLAY_STYLES.some((style) => style.id === value)
        ? (value as TitleOverlayStyle)
        : DEFAULT_TITLE_OVERLAY_STYLE;
}

export function normalizeTitleOverlayDuration(value: string | undefined): TitleOverlayDuration {
    return TITLE_OVERLAY_DURATIONS.some((duration) => duration.id === value)
        ? (value as TitleOverlayDuration)
        : DEFAULT_TITLE_OVERLAY_DURATION;
}

export function normalizeTitleOverlayLanguage(value: string | undefined): TitleOverlayLanguage {
    return TITLE_OVERLAY_LANGUAGES.some((language) => language.id === value)
        ? (value as TitleOverlayLanguage)
        : DEFAULT_TITLE_OVERLAY_LANGUAGE;
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

function shouldUseRemoteDialogueStaging(prompt: string) {
    return /打电话|通电话|接电话|挂电话|电话里|电话中|电话那头|来电|视频通话|语音通话|远程会议|远程对话|phone call|telephone call|on the phone|video call|remote call|zoom call|facetime|call me|calls me|calling me|called me/i.test(
        prompt
    );
}

function avoidGeneratedCaptionsPattern() {
    return new RegExp(`\\n?${AVOID_GENERATED_CAPTIONS_PROMPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
}

export function cleanPromptForReuse(prompt: string): string {
    return stripCaptionDirective(prompt).replace(avoidGeneratedCaptionsPattern(), '').trimEnd();
}

function stripCaptionDirective(prompt: string): string {
    const prioritized = prompt.trimStart();
    if (prioritized.startsWith(PARAMETER_PRIORITY_PROMPT_HEADER)) {
        const contentMarker = `\n${CREATIVE_CONTENT_PROMPT_HEADER}\n`;
        const contentIndex = prioritized.indexOf(contentMarker);
        if (contentIndex < 0) return '';
        const content = prioritized.slice(contentIndex + contentMarker.length);
        const finalLockIndex = content.indexOf(`\n${FINAL_PARAMETER_LOCK_PROMPT_HEADER}`);
        return (finalLockIndex >= 0 ? content.slice(0, finalLockIndex) : content).trimEnd();
    }

    const markerIndex = [GENERATED_CAPTIONS_PROMPT_HEADER, LANGUAGE_PROMPT_HEADER, TITLE_OVERLAY_PROMPT_HEADER]
        .map((marker) => prompt.indexOf(`\n${marker}`))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)[0];
    const firstLineMarker = [
        GENERATED_CAPTIONS_PROMPT_HEADER,
        LANGUAGE_PROMPT_HEADER,
        TITLE_OVERLAY_PROMPT_HEADER
    ].some((marker) => prompt.startsWith(marker));
    const firstMarkerIndex = markerIndex;
    if (firstMarkerIndex !== undefined) return prompt.slice(0, firstMarkerIndex).trimEnd();
    if (firstLineMarker) return '';
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
    const trimmed = cleanPromptForReuse(prompt);
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
            ? `Render subtitles only from the lines above. Include every listed language in the same subtitle block when English and Chinese are both listed: ${activeLanguageLabels.join(', ')}.`
            : 'Render only the subtitle line above.',
        SUBTITLE_LAYOUT_PROMPT,
        ...(activeLanguageLabels.length > 1 ? [BILINGUAL_SUBTITLE_LAYOUT_PROMPT] : [])
    ].join('\n');

    return trimmed ? `${trimmed}\n${directive}` : directive;
}

export function promptWithLanguageControls(
    prompt: string,
    options: {
        voiceLanguage?: string;
        captionMode?: string;
        titleOverlay?: { enabled?: boolean; text?: string; style?: string; duration?: string; language?: string };
    }
): string {
    const voiceLanguage = normalizeVoiceLanguage(options.voiceLanguage);
    const captionMode = normalizeCaptionMode(options.captionMode);
    const sourcePrompt = cleanPromptForReuse(prompt);
    const trimmed = sourcePrompt;
    const voice = VOICE_LANGUAGE_OPTIONS.find((item) => item.id === voiceLanguage);
    const voicePromptLabel = voice?.promptLabel ?? 'American English';
    const lines = [
        LANGUAGE_PROMPT_HEADER,
        voiceLanguage === SILENT_VOICE_LANGUAGE
            ? 'Audio: no spoken dialogue, no voiceover, no generated speech.'
            : `Audio: use natural ${voicePromptLabel} for spoken dialogue by default.`
    ];
    if (voiceLanguage !== SILENT_VOICE_LANGUAGE) {
        lines.push(
            `Spoken dialogue must be in ${voicePromptLabel}. If the script contains multiple languages, use only the ${voicePromptLabel} dialogue lines for audio; treat other-language lines as subtitle or translation references only.`
        );
        if (voiceLanguage === DEFAULT_VOICE_LANGUAGE) {
            lines.push(
                'When Chinese and English dialogue pairs are provided, speak the English lines only. Do not speak the Chinese translation aloud.'
            );
            if (/[\u3400-\u9fff]/.test(sourcePrompt)) {
                lines.push(
                    'If any intended narration or dialogue exists only in Chinese, translate its meaning into natural American English before speaking. Never read Chinese source text aloud and never generate Mandarin or Chinese speech.'
                );
            }
        }
        lines.push(DIALOGUE_PACING_PROMPT);
        if (shouldUseRemoteDialogueStaging(trimmed)) lines.push(REMOTE_DIALOGUE_PROMPT);
        if (voiceLanguage === DEFAULT_VOICE_LANGUAGE) {
            lines.push(
                'Final audio constraint: every spoken word in the soundtrack must be natural American English. Chinese text is reference material only and must never be spoken.'
            );
        }
    }

    if (captionMode === 'none') {
        lines.push('Subtitles: no subtitles, no captions, no on-screen subtitle text.');
    } else if (captionMode.startsWith('auto-')) {
        if (captionMode === 'auto-en-US') {
            lines.push(
                'Subtitles are required, not optional. Render visible American English subtitles directly in the generated video for every spoken dialogue beat. A result without visible English subtitles is invalid.'
            );
        } else if (captionMode === 'auto-zh-CN') {
            lines.push(
                'Subtitles are required, not optional. Render visible Simplified Chinese subtitles directly in the generated video for every spoken dialogue beat. A result without visible Chinese subtitles is invalid.'
            );
        } else {
            lines.push(
                'Subtitles are required, not optional. Render visible bilingual subtitles directly in the generated video for every spoken dialogue beat. A result without visible English and Simplified Chinese subtitles is invalid.',
                BILINGUAL_SUBTITLE_LAYOUT_PROMPT
            );
        }
        lines.push(
            'Studio will also create a timed player subtitle track directly from the selected script after generation.',
            SUBTITLE_LAYOUT_PROMPT
        );
    } else {
        lines.push(
            'Subtitle delivery: Studio will permanently burn the selected script-timed subtitles into the generated video after generation. Keep the lower subtitle safe area visually clear.'
        );
        if (captionMode === 'burn-bilingual-en-zh') {
            lines.push(
                'Bilingual burned subtitle requirement: preserve every paired English and Simplified Chinese dialogue line in the creative content. Studio must burn English on the first line and the matching Simplified Chinese translation directly below it for every dialogue beat.'
            );
        }
    }

    const directive = [PARAMETER_PRIORITY_PROMPT_HEADER, ...lines].join('\n');
    const finalLock = [
        FINAL_PARAMETER_LOCK_PROMPT_HEADER,
        'The selected audio language and subtitle delivery settings are mandatory. They override any conflicting instruction in the creative content.'
    ].join('\n');
    return trimmed
        ? `${directive}\n${CREATIVE_CONTENT_PROMPT_HEADER}\n${trimmed}\n${finalLock}`
        : `${directive}\n${finalLock}`;
}
