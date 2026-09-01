export const AVOID_GENERATED_CAPTIONS_PROMPT =
    'No subtitles, no captions, no on-screen text, no burned-in text overlays.';

export function promptWithCaptionGuard(prompt: string): string {
    const trimmed = prompt.trimEnd();
    if (!trimmed) return AVOID_GENERATED_CAPTIONS_PROMPT;
    return trimmed.toLowerCase().includes(AVOID_GENERATED_CAPTIONS_PROMPT.toLowerCase())
        ? trimmed
        : `${trimmed}\n${AVOID_GENERATED_CAPTIONS_PROMPT}`;
}
