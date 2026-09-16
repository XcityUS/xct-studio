import { portraitGroupLabel } from '@/features/assets/components/AssetsPanel/utils';
import { reviewProviderAsset } from '@/features/assets/hooks/use-provider-asset-review';
import { normalizeProviderAssetName, PROVIDER_ASSET_NAME_MAX_LENGTH } from '@/features/assets/portrait/name';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import { refKey, type ReferenceDeclaration } from '@/features/assets/reference/origin';
import { parsePortraits } from '@/features/generation/history/portraits';
import { providerReferenceUrl, withPortraitDeclarations } from '@/features/studio/components/StudioWorkspace/utils';
import { describe, expect, it, vi } from 'vitest';

const sourceUrl = 'https://media.xcity.ai/media/u/user/refs/material.png';

describe('provider asset review state', () => {
    it('reuses an existing approved source image without submitting a duplicate asset', async () => {
        const existing = {
            assetId: 'asset-1',
            groupId: 'group-1',
            groupType: 'AIGC' as const,
            name: 'Material',
            thumbUrl: sourceUrl,
            status: 'Active' as const,
            assetType: 'Image' as const,
            updatedAt: 10
        };
        const createGroup = vi.fn(async () => ({ groupId: 'new-group' }));
        const createAsset = vi.fn(async () => ({ assetId: 'new-asset', status: 'Processing' as const }));
        const setDeclaration = vi.fn();
        const result = await reviewProviderAsset(
            {
                enabled: true,
                declarations: {},
                syncCloudNow: async () => {},
                syncNow: async () => {},
                findAssetByUrl: () => existing,
                saveAsset: () => {},
                setDeclaration,
                createGroup,
                createAsset,
                getAsset: async () => ({
                    assetId: 'asset-1',
                    groupId: 'group-1',
                    status: 'Active',
                    previewUrl: sourceUrl,
                    failureReason: ''
                })
            },
            { url: sourceUrl, name: 'Material', origin: 'uploaded' }
        );

        expect(result).toBe('asset://asset-1');
        expect(createGroup).not.toHaveBeenCalled();
        expect(createAsset).not.toHaveBeenCalled();
        expect(setDeclaration).toHaveBeenCalledWith(
            refKey(sourceUrl),
            expect.objectContaining({ assetId: 'asset-1', origin: 'uploaded' })
        );
    });

    it('tracks a new submission as processing before marking it active', async () => {
        const saveAsset = vi.fn();
        const setDeclaration = vi.fn();
        const createGroup = vi.fn(async () => ({ groupId: 'group-1' }));
        const result = await reviewProviderAsset(
            {
                enabled: true,
                declarations: {},
                syncCloudNow: async () => {},
                syncNow: async () => {},
                findAssetByUrl: () => undefined,
                saveAsset,
                setDeclaration,
                createGroup,
                createAsset: async () => ({ assetId: 'asset-1', status: 'Processing' }),
                getAsset: async () => ({
                    assetId: 'asset-1',
                    groupId: 'group-1',
                    status: 'Active',
                    previewUrl: sourceUrl,
                    failureReason: ''
                })
            },
            { url: sourceUrl, name: 'Material', origin: 'uploaded', assetType: 'Video' }
        );

        expect(result).toBe('asset://asset-1');
        expect(createGroup).toHaveBeenCalledWith('Reviewed materials');
        expect(saveAsset.mock.calls.map(([asset]) => asset.status)).toEqual(['Processing', 'Active']);
        expect(setDeclaration).toHaveBeenCalledWith(refKey(sourceUrl), expect.objectContaining({ assetId: 'asset-1' }));
    });

    it('uses the project title instead of the provider slug for a generated asset directory', () => {
        expect(
            portraitGroupLabel(
                {
                    id: 'group-1',
                    name: 'xcity:owner:character-1234567890',
                    displayName: '我的短剧项目',
                    groupType: 'AIGC'
                },
                'group-1'
            )
        ).toBe('我的短剧项目');
    });

    it('normalizes provider asset names to the BytePlus 64-character limit', () => {
        const normalized = normalizeProviderAssetName(`  ${'素材'.repeat(40)}  `);

        expect(Array.from(normalized)).toHaveLength(PROVIDER_ASSET_NAME_MAX_LENGTH);
        expect(normalized.startsWith('素材')).toBe(true);
        expect(normalizeProviderAssetName('   ')).toBe('Reviewed material');
    });

    it('preserves the declared source when restoring reviewed assets', () => {
        const [asset] = parsePortraits([
            {
                assetId: 'asset-1',
                groupId: 'group-1',
                groupType: 'AIGC',
                assetType: 'Video',
                referenceOrigin: 'no-person',
                name: 'Material',
                thumbUrl: sourceUrl,
                status: 'Active',
                updatedAt: 10
            }
        ]);

        expect(asset).toMatchObject({ referenceOrigin: 'no-person', assetType: 'Video' });
    });

    it.each(['public-figure', 'licensed-ip'] as const)('persists %s provider Asset IDs', (origin) => {
        const [asset] = parsePortraits([
            {
                assetId: 'asset-ip-1',
                groupId: 'group-ip-1',
                groupType: 'AIGC',
                referenceOrigin: origin,
                name: 'Licensed material',
                thumbUrl: sourceUrl,
                status: 'Processing',
                updatedAt: 10
            }
        ]);

        expect(asset).toMatchObject({ assetId: 'asset-ip-1', referenceOrigin: origin, status: 'Processing' });
    });

    it('only creates an admitted asset declaration for an active provider asset', () => {
        const declarations: Record<string, ReferenceDeclaration> = {
            [refKey(sourceUrl)]: { origin: 'no-person', declaredAt: 1 }
        };
        const baseAsset = {
            assetId: 'asset-1',
            groupId: 'group-1',
            groupType: 'AIGC' as const,
            referenceOrigin: 'no-person' as const,
            name: 'Material',
            thumbUrl: sourceUrl,
            updatedAt: 10
        };

        const processing = withPortraitDeclarations(declarations, [{ ...baseAsset, status: 'Processing' }]);
        expect(processing[refKey(portraitReferenceUrl('asset-1'))]).toBeUndefined();

        const active = withPortraitDeclarations(declarations, [{ ...baseAsset, status: 'Active' }]);
        expect(active[refKey(portraitReferenceUrl('asset-1'))]).toMatchObject({
            origin: 'no-person',
            assetId: 'asset-1',
            groupId: 'group-1'
        });
    });

    it('keeps the source URL for display and resolves its Asset ID for provider submission', () => {
        const declarations: Record<string, ReferenceDeclaration> = {
            [refKey(sourceUrl)]: { origin: 'no-person', declaredAt: 1, assetId: 'asset-1' }
        };

        expect(providerReferenceUrl(sourceUrl, declarations)).toBe('asset://asset-1');
        expect(providerReferenceUrl('asset://asset-1', declarations)).toBe('asset://asset-1');
        expect(providerReferenceUrl('https://example.com/unreviewed.mp4', declarations)).toBe(
            'https://example.com/unreviewed.mp4'
        );
    });
});
