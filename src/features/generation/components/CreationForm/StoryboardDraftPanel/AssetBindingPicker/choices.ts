import type { ProjectAsset } from '@/shared/contracts/production';

export function reviewedAssetChoices(assets: ProjectAsset[]): { value: string; name: string }[] {
    const seen = new Set<string>();
    return assets.flatMap((asset) => {
        const value = asset.providerAssetId?.trim();
        if (asset.status !== 'active' || !value || seen.has(value)) return [];
        seen.add(value);
        return [{ value, name: asset.name }];
    });
}
