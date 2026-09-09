import {
    isAssetReferenceUrl,
    refKey,
    type ReferenceDeclaration,
    type ReferenceOrigin
} from '@/features/assets/reference/origin';
import type { VideoPortrait } from '@/features/generation/history/merge';

export function isReferenceImagePortrait(portrait: Pick<VideoPortrait, 'assetType'>): boolean {
    return portrait.assetType === undefined || portrait.assetType === 'Image';
}

export function isHttpImageUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export function isReferenceImageUrl(url: string): boolean {
    return isHttpImageUrl(url) || isAssetReferenceUrl(url);
}

export function assetReferenceLabel(url: string): string {
    const assetId = url.trim().replace(/^asset:\/\//, '');
    return assetId.length > 8 ? assetId.slice(-8) : assetId;
}

export function declarationForUrl(
    declarations: Record<string, ReferenceDeclaration>,
    url: string
): ReferenceDeclaration | undefined {
    const key = refKey(url);
    return key ? declarations[key] : undefined;
}

export function declarationActionLabel(origin: ReferenceOrigin): string | null {
    if (origin === 'public-figure' || origin === 'licensed-ip') return 'Submit authorization';
    if (origin === 'no-person' || origin === 'official-asset' || origin === 'real-person') {
        return 'Set this up in Assets';
    }
    return null;
}
