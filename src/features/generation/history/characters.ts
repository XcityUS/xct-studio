import { assetIdFromReferenceUrl } from '@/features/assets/reference/origin';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/history/merge';

const NON_IMAGE_MEDIA_PATH = /\.(?:mp4|m4v|mov|webm|avi|mkv|mp3|m4a|aac|wav|ogg|flac)$/i;

function imageWebUrl(value: string | undefined): string | null {
    const url = value?.trim();
    if (!url || !/^https?:\/\//i.test(url)) return null;
    try {
        return NON_IMAGE_MEDIA_PATH.test(new URL(url).pathname) ? null : url;
    } catch {
        return null;
    }
}

/** Keeps provider-only asset references out of browser image sources. */
export function characterPreviewUrl(character: VideoCharacter, portraits: VideoPortrait[]): string | null {
    const storedPreview = imageWebUrl(character.previewUrl);
    if (storedPreview) return storedPreview;

    const sourceUrl = imageWebUrl(character.url);
    if (sourceUrl) return sourceUrl;

    const assetId = assetIdFromReferenceUrl(character.url);
    if (!assetId) return null;
    return imageWebUrl(portraits.find((portrait) => portrait.assetId === assetId)?.thumbUrl);
}
