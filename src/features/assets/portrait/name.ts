export const PROVIDER_ASSET_NAME_MAX_LENGTH = 64;

export function normalizeProviderAssetName(value: string, fallback = 'Reviewed material'): string {
    const name = value.trim() || fallback;
    return Array.from(name).slice(0, PROVIDER_ASSET_NAME_MAX_LENGTH).join('');
}
