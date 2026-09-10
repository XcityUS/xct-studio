import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/hooks/use-video-history';

export function appendCharacterPromptLine(prompt: string, imageIndex: number, name: string): string {
    const line = `[Image ${imageIndex}] is ${name}.`;
    const trimmed = prompt.trimEnd();
    return trimmed ? `${trimmed}\n${line}` : line;
}

export function referenceLabelsFor(
    referenceUrls: string[],
    characters: VideoCharacter[],
    portraits: VideoPortrait[]
): (string | null)[] {
    const labels = new Map<string, string>([
        ...characters.map((character) => [character.url, character.name] as const),
        ...portraits.map((portrait) => [portraitReferenceUrl(portrait.assetId), portrait.name] as const)
    ]);
    return referenceUrls.map((url) => labels.get(url) ?? null);
}

export function referenceVideoPreviewsFor(portraits: VideoPortrait[]): Map<string, string> {
    return new Map(
        portraits
            .filter((portrait) => portrait.thumbUrl)
            .map((portrait) => [portraitReferenceUrl(portrait.assetId), portrait.thumbUrl as string] as const)
    );
}
