export const AVOID_GENERATED_CAPTIONS_PROMPT =
    'No subtitles, no captions, no on-screen text, no burned-in text overlays.';
const GENERATED_CAPTIONS_PROMPT_HEADER = 'Caption overlay instructions:';
export const MAX_GENERATED_CAPTIONS = 2;

export function normalizeGeneratedCaptionTexts(captions: readonly string[] | undefined): string[] {
    return (captions ?? [])
        .map((caption) => caption.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .slice(0, MAX_GENERATED_CAPTIONS);
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

export function promptWithGeneratedCaptions(prompt: string, captions: readonly string[]): string {
    const captionTexts = normalizeGeneratedCaptionTexts(captions);
    const trimmed = stripCaptionDirective(prompt)
        .replace(new RegExp(`\\n?${AVOID_GENERATED_CAPTIONS_PROMPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
        .trimEnd();
    if (captionTexts.length === 0) return promptWithCaptionGuard(trimmed);

    const captionLines = captionTexts.map((caption, index) => `${index + 1}. "${caption.replace(/"/g, "'")}"`);
    const directive = [
        GENERATED_CAPTIONS_PROMPT_HEADER,
        ...captionLines,
        'Render only these captions. Keep them inside the lower safe area with clear spacing. If the text is long, wrap it or reduce the font size so caption lines never overlap.'
    ].join('\n');

    return trimmed ? `${trimmed}\n${directive}` : directive;
}
