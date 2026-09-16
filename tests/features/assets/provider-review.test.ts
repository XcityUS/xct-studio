import { normalizeProviderAssetName, PROVIDER_ASSET_NAME_MAX_LENGTH } from '@/features/assets/portrait/name';
import { portraitGroupLabel } from '@/features/assets/components/AssetsPanel/utils';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import {
    declarationBlockReason,
    declarationSatisfied,
    refKey,
    referenceRequiresAssetLibrary,
    type ReferenceDeclaration
} from '@/features/assets/reference/origin';
import { parsePortraits } from '@/features/generation/history/portraits';
import { providerReferenceUrl, withPortraitDeclarations } from '@/features/studio/components/StudioWorkspace/utils';
import { describe, expect, it } from 'vitest';

const sourceUrl = 'https://media.xcity.ai/media/u/user/refs/material.png';

describe('provider asset review state', () => {
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

    it('allows no-person, no-IP references without a provider Asset ID', () => {
        const declaration: ReferenceDeclaration = { origin: 'no-person', declaredAt: 1 };

        expect(declarationSatisfied(declaration)).toBe(true);
        expect(declarationBlockReason(declaration)).toBeNull();
        expect(referenceRequiresAssetLibrary(sourceUrl, declaration)).toBe(false);
    });

    it.each(['public-figure', 'licensed-ip'] as const)('still requires an Asset ID for %s references', (origin) => {
        const declaration: ReferenceDeclaration = { origin, declaredAt: 1 };

        expect(declarationSatisfied(declaration)).toBe(false);
        expect(declarationBlockReason(declaration)).toMatch(/provider asset library|IP image/);
        expect(referenceRequiresAssetLibrary(sourceUrl, declaration)).toBe(true);
    });
});
