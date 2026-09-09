import { buildAssetList, selectablePortraitSourceAssets } from '@/features/assets/components/AssetsPanel/asset-list';
import type { ProviderLibraryAsset } from '@/features/assets/portrait/api';
import { refKey } from '@/features/assets/reference/origin';
import type { VideoPortrait } from '@/features/generation/history/merge';
import type { UserAsset } from '@/lib/media-archive';
import { describe, expect, it } from 'vitest';

function asset(key: string, uploaded: string): UserAsset {
    return {
        key,
        url: `https://media.xcity.ai/${key}`,
        bytes: 1024,
        uploaded,
        kind: 'image',
        name: key
    };
}

function portrait(source: UserAsset, status: VideoPortrait['status'], assetId: string): VideoPortrait {
    return {
        assetId,
        groupId: 'group-1',
        groupType: 'AIGC',
        assetType: 'Image',
        name: source.name ?? source.key,
        thumbUrl: source.url,
        status,
        referenceOrigin: 'no-person',
        updatedAt: 10
    };
}

describe('buildAssetList', () => {
    it('puts usable assets first and replaces reviewed URLs with Asset IDs', () => {
        const missing = asset('missing.png', '2026-09-08T12:00:00Z');
        const reviewed = asset('reviewed.png', '2026-09-07T12:00:00Z');
        const processing = asset('processing.png', '2026-09-06T12:00:00Z');

        const result = buildAssetList(
            [missing, processing, reviewed],
            [portrait(reviewed, 'Active', 'asset-active'), portrait(processing, 'Processing', 'asset-processing')],
            {}
        );

        expect(result.map((item) => item.reviewState)).toEqual(['active', 'processing', 'missing']);
        expect(result[0]?.referenceUrl).toBe('asset://asset-active');
        expect(result[1]?.referenceUrl).toBeUndefined();
    });

    it('allows declared Seedream output without creating an Asset ID', () => {
        const seedream = asset('seedream.png', '2026-09-08T12:00:00Z');
        const result = buildAssetList([seedream], [], {
            [refKey(seedream.url)]: { origin: 'byteplus-ai', model: 'seedream-4.0', declaredAt: 1 }
        });

        expect(result[0]).toMatchObject({ reviewState: 'exempt', referenceUrl: seedream.url });
    });

    it('merges BytePlus records into the same list and removes URL duplicates', () => {
        const reviewed = asset('reviewed.png', '2026-09-07T12:00:00Z');
        const providerAssets: ProviderLibraryAsset[] = [
            {
                assetId: 'asset-active',
                groupId: 'group-1',
                groupType: 'AIGC',
                name: 'Reviewed image',
                previewUrl: reviewed.url,
                assetType: 'Image',
                status: 'Active',
                failureReason: '',
                createdAt: '2026-09-07T12:00:00Z',
                updatedAt: '2026-09-08T12:00:00Z'
            },
            {
                assetId: 'asset-processing',
                groupId: 'group-1',
                groupType: 'AIGC',
                name: 'Provider only',
                previewUrl: 'https://provider.example/provider-only.png',
                assetType: 'Image',
                status: 'Processing',
                failureReason: '',
                createdAt: '2026-09-08T12:00:00Z',
                updatedAt: ''
            }
        ];

        const result = buildAssetList([reviewed], [], {}, providerAssets);

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            source: 'cloud',
            providerAsset: { assetId: 'asset-active' },
            reviewState: 'active',
            referenceUrl: 'asset://asset-active'
        });
        expect(result[1]).toMatchObject({ source: 'provider', reviewState: 'processing' });
    });

    it('keeps BytePlus inventory visible when the upload archive is empty', () => {
        const providerAssets: ProviderLibraryAsset[] = [
            {
                assetId: 'asset-video',
                groupId: 'group-1',
                groupType: 'AIGC',
                name: 'Reviewed video',
                previewUrl: 'https://provider.example/reviewed.mp4',
                assetType: 'Video',
                status: 'Active',
                failureReason: '',
                createdAt: '2026-09-09T00:00:00Z',
                updatedAt: '2026-09-09T00:01:00Z'
            }
        ];

        expect(buildAssetList([], [], {}, providerAssets)).toMatchObject([
            {
                source: 'provider',
                providerAsset: { assetId: 'asset-video' },
                reviewState: 'active',
                referenceUrl: 'asset://asset-video',
                asset: { kind: 'video' }
            }
        ]);
    });

    it('does not resurrect provider assets hidden by local delete tombstones', () => {
        const providerAssets: ProviderLibraryAsset[] = [
            {
                assetId: 'asset-deleted',
                groupId: 'group-1',
                groupType: 'AIGC',
                name: 'Deleted provider asset',
                previewUrl: 'https://provider.example/deleted.png',
                assetType: 'Image',
                status: 'Active',
                failureReason: '',
                createdAt: '2026-09-09T00:00:00Z',
                updatedAt: '2026-09-09T00:01:00Z'
            }
        ];

        expect(buildAssetList([], [], {}, providerAssets, ['asset-deleted'])).toEqual([]);
    });

    it('hides uploaded assets by deleted archive key', () => {
        const deleted = asset('deleted.png', '2026-09-09T00:00:00Z');

        expect(buildAssetList([deleted], [], {}, [], ['deleted.png'])).toEqual([]);
    });

    it('hides provider assets by deleted preview URL', () => {
        const previewUrl = 'https://provider.example/deleted.png';
        const providerAssets: ProviderLibraryAsset[] = [
            {
                assetId: 'asset-active',
                groupId: 'group-1',
                groupType: 'AIGC',
                name: 'Deleted provider preview',
                previewUrl,
                assetType: 'Image',
                status: 'Active',
                failureReason: '',
                createdAt: '2026-09-09T00:00:00Z',
                updatedAt: '2026-09-09T00:01:00Z'
            }
        ];

        expect(buildAssetList([], [], {}, providerAssets, [refKey(previewUrl)])).toEqual([]);
    });

    it('excludes active images from portrait source selectors', () => {
        const reviewed = asset('reviewed.png', '2026-09-07T12:00:00Z');
        const processing = asset('processing.png', '2026-09-08T12:00:00Z');
        const items = buildAssetList(
            [reviewed, processing],
            [portrait(reviewed, 'Active', 'asset-active'), portrait(processing, 'Processing', 'asset-processing')],
            {}
        );

        expect(selectablePortraitSourceAssets(items).map((item) => item.key)).toEqual(['processing.png']);
    });
});
