import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import { refKey, type ReferenceDeclaration } from '@/features/assets/reference/origin';
import { parsePortraits } from '@/features/generation/history/portraits';
import { withPortraitDeclarations } from '@/features/studio/components/StudioWorkspace/utils';
import { describe, expect, it } from 'vitest';

const sourceUrl = 'https://media.xcity.ai/media/u/user/refs/material.png';

describe('provider asset review state', () => {
    it('preserves the declared source when restoring reviewed assets', () => {
        const [asset] = parsePortraits([
            {
                assetId: 'asset-1',
                groupId: 'group-1',
                groupType: 'AIGC',
                referenceOrigin: 'no-person',
                name: 'Material',
                thumbUrl: sourceUrl,
                status: 'Active',
                updatedAt: 10
            }
        ]);

        expect(asset?.referenceOrigin).toBe('no-person');
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
});
