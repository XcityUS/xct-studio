import type { ProviderLibraryAsset } from '@/features/assets/portrait/api';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import { isSeedreamExempt, refKey, type ReferenceDeclaration } from '@/features/assets/reference/origin';
import type { VideoPortrait } from '@/features/generation/history/merge';
import type { UserAsset } from '@/lib/media-archive';

export type AssetReviewState = 'active' | 'exempt' | 'processing' | 'failed' | 'missing';

export type AssetListItem = {
    asset: UserAsset;
    portrait?: VideoPortrait;
    providerAsset?: ProviderLibraryAsset;
    referenceUrl?: string;
    reviewState: AssetReviewState;
    source: 'cloud' | 'provider';
};

export function selectablePortraitSourceAssets(items: AssetListItem[]): UserAsset[] {
    return items
        .filter((item) => item.source === 'cloud' && item.asset.kind === 'image' && item.reviewState !== 'active')
        .map((item) => item.asset);
}

function latestPortraitFor(asset: UserAsset, portraits: VideoPortrait[]): VideoPortrait | undefined {
    const key = refKey(asset.url);
    return portraits.reduce<VideoPortrait | undefined>((latest, portrait) => {
        if (refKey(portrait.thumbUrl) !== key) return latest;
        return !latest || portrait.updatedAt >= latest.updatedAt ? portrait : latest;
    }, undefined);
}

function uploadedAt(asset: UserAsset): number {
    const value = asset.uploaded ? Date.parse(asset.uploaded) : 0;
    return Number.isFinite(value) ? value : 0;
}

function reviewRank(state: AssetReviewState): number {
    if (state === 'active' || state === 'exempt') return 0;
    if (state === 'processing') return 1;
    return 2;
}

export function buildAssetList(
    assets: UserAsset[],
    portraits: VideoPortrait[],
    declarations: Record<string, ReferenceDeclaration>,
    providerAssets: ProviderLibraryAsset[] = [],
    deletedIds: string[] = []
): AssetListItem[] {
    const tombstoned = new Set(deletedIds);
    const isDeletedUrl = (url: string) => tombstoned.has(refKey(url));
    const isDeletedAsset = (asset: UserAsset) => tombstoned.has(asset.key) || isDeletedUrl(asset.url);
    const visiblePortraits = portraits.filter((portrait) => !tombstoned.has(portrait.assetId));
    const visibleProviderAssets = providerAssets.filter(
        (asset) => !tombstoned.has(asset.assetId) && (!asset.previewUrl || !isDeletedUrl(asset.previewUrl))
    );
    const providerPortraits = visibleProviderAssets.map(
        (asset): VideoPortrait => ({
            assetId: asset.assetId,
            groupId: asset.groupId,
            groupType: asset.groupType,
            name: asset.name,
            thumbUrl: asset.previewUrl,
            status: asset.status === 'Active' || asset.status === 'Failed' ? asset.status : 'Processing',
            assetType: asset.assetType,
            failureReason: asset.failureReason,
            updatedAt: Date.parse(asset.updatedAt || asset.createdAt) || 0
        })
    );
    const allPortraits = visiblePortraits.concat(providerPortraits);
    const cloudItems = assets.flatMap((asset): AssetListItem[] => {
        if (isDeletedAsset(asset)) return [];
        if (asset.kind === 'audio') return [{ asset, reviewState: 'missing', source: 'cloud' }];

        const portrait = latestPortraitFor(asset, allPortraits);
        const providerAsset = visibleProviderAssets.find(
            (candidate) =>
                candidate.assetId === portrait?.assetId ||
                Boolean(candidate.previewUrl && refKey(candidate.previewUrl) === refKey(asset.url))
        );
        if (portrait?.status === 'Active') {
            return [
                {
                    asset,
                    portrait,
                    providerAsset,
                    reviewState: 'active',
                    referenceUrl: portraitReferenceUrl(portrait.assetId),
                    source: 'cloud'
                }
            ];
        }
        if (portrait?.status === 'Processing') {
            return [{ asset, portrait, providerAsset, reviewState: 'processing', source: 'cloud' }];
        }
        if (portrait?.status === 'Failed') {
            return [{ asset, portrait, providerAsset, reviewState: 'failed', source: 'cloud' }];
        }

        const declaration = declarations[refKey(asset.url)];
        if (isSeedreamExempt(declaration)) {
            return [{ asset, reviewState: 'exempt', referenceUrl: asset.url, source: 'cloud' }];
        }
        if (declaration?.assetId) {
            const declaredProviderAsset = visibleProviderAssets.find(
                (candidate) => candidate.assetId === declaration.assetId
            );
            return [
                {
                    asset,
                    providerAsset: declaredProviderAsset,
                    reviewState: 'active',
                    referenceUrl: portraitReferenceUrl(declaration.assetId),
                    source: 'cloud'
                }
            ];
        }
        return [{ asset, reviewState: 'missing', source: 'cloud' }];
    });
    const cloudAssetIds = new Set(cloudItems.map((item) => item.portrait?.assetId).filter(Boolean));
    const cloudUrls = new Set(assets.map((asset) => refKey(asset.url)));
    const providerItems = visibleProviderAssets
        .filter(
            (asset) =>
                !cloudAssetIds.has(asset.assetId) && (!asset.previewUrl || !cloudUrls.has(refKey(asset.previewUrl)))
        )
        .map((provider): AssetListItem => {
            const portrait = providerPortraits.find((item) => item.assetId === provider.assetId);
            const reviewState: AssetReviewState =
                provider.status === 'Active' ? 'active' : provider.status === 'Failed' ? 'failed' : 'processing';
            return {
                asset: {
                    key: `byteplus/${provider.assetId}`,
                    url: provider.previewUrl,
                    bytes: null,
                    uploaded: provider.createdAt || provider.updatedAt || null,
                    kind: provider.assetType === 'Video' ? 'video' : provider.assetType === 'Audio' ? 'audio' : 'image',
                    name: provider.name || 'Reviewed material'
                },
                portrait,
                providerAsset: provider,
                reviewState,
                referenceUrl: reviewState === 'active' ? portraitReferenceUrl(provider.assetId) : undefined,
                source: 'provider'
            };
        });

    return cloudItems.concat(providerItems).sort((left, right) => {
        const rank = reviewRank(left.reviewState) - reviewRank(right.reviewState);
        return rank || uploadedAt(right.asset) - uploadedAt(left.asset);
    });
}
