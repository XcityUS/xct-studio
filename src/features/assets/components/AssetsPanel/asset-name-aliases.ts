import { refKey } from '@/features/assets/reference/origin';
import { businessStorage } from '@/features/persistence/store';
import type { UserAsset } from '@/lib/media-archive';

const STORAGE_KEY = 'xctStudioAssetNameAliases';

export function assetNameAliasKey(asset: UserAsset): string {
    return asset.key || refKey(asset.url);
}

export function readAssetNameAliases(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    try {
        const parsed = JSON.parse(businessStorage.getItem(STORAGE_KEY) ?? '{}') as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : ''])
                .filter(([, value]) => value)
        );
    } catch {
        return {};
    }
}

export function writeAssetNameAliases(aliases: Record<string, string>) {
    if (typeof window !== 'undefined') businessStorage.setItem(STORAGE_KEY, JSON.stringify(aliases));
}

export function applyAssetNameAlias(asset: UserAsset, aliases: Record<string, string>): UserAsset {
    const alias = aliases[assetNameAliasKey(asset)]?.trim();
    return alias ? { ...asset, name: alias } : asset;
}
