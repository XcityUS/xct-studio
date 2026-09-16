import type { AuthorizationTargetOption } from './types';
import type { AuthorizationItem } from '@/features/assets/authorization/api';
import { type PortraitGroup } from '@/features/assets/portrait/api';
import { refKey } from '@/features/assets/reference/origin';
import type { ReferenceDeclaration } from '@/features/assets/reference/origin';
import type { VideoPortrait } from '@/features/generation/history/merge';
import type { UserAsset } from '@/lib/media-archive';

export function portraitCollections(
    assets: UserAsset[] | null,
    groups: PortraitGroup[] | null,
    portraits: VideoPortrait[],
    declarations: Record<string, ReferenceDeclaration>
) {
    const originFor = (portrait: VideoPortrait) =>
        portrait.referenceOrigin ?? declarations[refKey(portrait.thumbUrl)]?.origin;
    return {
        imageAssets: (assets ?? []).filter((asset) => asset.kind === 'image'),
        livenessGroups: (groups ?? []).filter((group) => group.groupType === 'LivenessFace'),
        virtualGroups: (groups ?? []).filter(isCharacterAssetGroup),
        verifiedPortraits: portraits.filter((portrait) => portrait.groupType === 'LivenessFace'),
        virtualPortraits: portraits.filter(
            (portrait) => portrait.groupType === 'AIGC' && originFor(portrait) === 'thirdparty-ai'
        )
    };
}

export function isCharacterAssetGroup(group: PortraitGroup): boolean {
    if (group.groupType !== 'AIGC') return false;
    const slug = group.name.split(':').slice(2).join(':').trim().toLowerCase();
    return slug !== 'reviewed-materials';
}

export function formatBytes(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string, locale?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function authorizationStatusClass(status: AuthorizationItem['status']): string {
    if (status === 'approved') return 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200';
    if (status === 'rejected') return 'border-red-400/30 bg-red-400/[0.08] text-red-200';
    return 'border-amber-300/30 bg-amber-300/[0.08] text-amber-100';
}

export function shortReferenceKey(value: string): string {
    return value.length > 14 ? `${value.slice(0, 7)}...${value.slice(-6)}` : value;
}

export function defaultCharacterName(asset: UserAsset, fallbackName: string): string {
    const assetName = asset.name?.trim();
    if (assetName) return assetName;
    const leaf = asset.key.split('/').pop() ?? '';
    return (
        leaf
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]+/g, ' ')
            .trim() || fallbackName
    );
}

export function readableAssetStem(asset: UserAsset): string {
    const raw = asset.name?.trim() || asset.key.split('/').pop()?.trim() || '';
    const stem = raw
        .replace(/\.[^.]+$/, '')
        .replace(/^(video|image|audio)[-_]/i, '')
        .trim();
    if (!stem || /^[A-Za-z0-9_-]{28,}$/.test(stem)) return '';
    return stem.length > 24 ? `${stem.slice(0, 12)}...${stem.slice(-8)}` : stem;
}

export function authorizationAssetLabel(asset: UserAsset, index: number, kindLabel: string, locale?: string): string {
    const details = [
        readableAssetStem(asset),
        formatBytes(asset.bytes),
        formatDate(asset.uploaded ?? '', locale)
    ].filter(Boolean);
    return [`${kindLabel} ${index + 1}`, ...details].join(' · ');
}

export function isUploadedReferenceMedia(asset: UserAsset): boolean {
    return /\/(?:refs|videos)\//.test(asset.key) && (asset.kind === 'image' || asset.kind === 'video');
}

export function buildAuthorizationTargets(
    assets: UserAsset[] | null,
    imageAssetLabel: string,
    videoAssetLabel: string,
    locale: string
): AuthorizationTargetOption[] {
    return (assets ?? [])
        .filter(isUploadedReferenceMedia)
        .map((asset, index) => {
            const kind: 'image' | 'video' = asset.kind === 'video' ? 'video' : 'image';
            const kindLabel = kind === 'video' ? videoAssetLabel : imageAssetLabel;
            const sequenceLabel = `${kindLabel} ${index + 1}`;
            const displayName = readableAssetStem(asset) || sequenceLabel;
            const description = [
                displayName === sequenceLabel ? '' : sequenceLabel,
                formatBytes(asset.bytes),
                formatDate(asset.uploaded ?? '', locale)
            ]
                .filter(Boolean)
                .join(' · ');
            return {
                key: refKey(asset.url),
                label: authorizationAssetLabel({ ...asset, kind }, index, kindLabel, locale),
                displayName,
                description,
                url: asset.url,
                kind
            };
        })
        .filter((target) => target.key);
}

export function shortAssetId(assetId: string): string {
    return assetId.length > 8 ? assetId.slice(-8) : assetId;
}

export function portraitGroupLabel(group: PortraitGroup, fallbackLabel: string): string {
    const slug = group.name.split(':').slice(2).join(':').trim();
    return group.displayName?.trim() || slug || fallbackLabel;
}
