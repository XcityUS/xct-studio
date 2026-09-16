import type { ProjectAsset } from '@/shared/contracts/production';

export function assetBindingStatus(assetId: string | undefined, assets: ProjectAsset[]): ProjectAsset['status'] | 'unknown' | 'unbound' {
    const normalizedId = assetId?.trim();
    if (!normalizedId) return 'unbound';
    const matches = assets.filter((asset) => asset.providerAssetId?.trim() === normalizedId);
    if (matches.some((asset) => asset.status === 'active')) return 'active';
    return matches[0]?.status ?? 'unknown';
}

export function isUsableAssetBinding(assetId: string | undefined, assets: ProjectAsset[]): boolean {
    const status = assetBindingStatus(assetId, assets);
    return status === 'active' || status === 'unknown';
}

export function reviewedAssetChoices(assets: ProjectAsset[]): { value: string; name: string }[] {
    const seen = new Set<string>();
    return assets.flatMap((asset) => {
        const value = asset.providerAssetId?.trim();
        if (asset.status !== 'active' || !value || seen.has(value)) return [];
        seen.add(value);
        return [{ value, name: asset.name }];
    });
}
