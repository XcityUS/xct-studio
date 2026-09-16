import { reviewedAssetChoices } from '@/features/generation/components/CreationForm/StoryboardDraftPanel/AssetBindingPicker/choices';
import type { ProjectAsset } from '@/shared/contracts/production';
import { describe, expect, it } from 'vitest';

function asset(id: string, status: ProjectAsset['status'], providerAssetId?: string): ProjectAsset {
    return {
        id,
        projectId: 'project-1',
        name: id,
        kind: 'image',
        status,
        sourceType: 'upload',
        providerAssetId,
        createdAt: 1,
        updatedAt: 1
    };
}

describe('storyboard asset choices', () => {
    it('offers only reviewed project assets with a usable provider reference', () => {
        expect(
            reviewedAssetChoices([
                asset('unreviewed', 'uploaded', 'asset-1'),
                asset('pending', 'reviewing', 'asset-2'),
                asset('ready', 'active', ' asset-3 '),
                asset('duplicate', 'active', 'asset-3'),
                asset('unbound', 'active'),
                asset('revoked', 'revoked', 'asset-4')
            ])
        ).toEqual([{ value: 'asset-3', name: 'ready' }]);
    });
});
