import { assetBindingStatus, isUsableAssetBinding, reviewedAssetChoices } from '@/features/generation/components/CreationForm/StoryboardDraftPanel/AssetBindingPicker/choices';
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

    it('marks only usable bindings, while retaining the exact reason for a known blocked ID', () => {
        const assets = [asset('pending', 'reviewing', 'asset-1'), asset('ready', 'active', 'asset-2')];
        expect(assetBindingStatus('asset-1', assets)).toBe('reviewing');
        expect(isUsableAssetBinding('asset-1', assets)).toBe(false);
        expect(isUsableAssetBinding('asset-2', assets)).toBe(true);
        expect(isUsableAssetBinding('historical-id', assets)).toBe(true);
        expect(isUsableAssetBinding(undefined, assets)).toBe(false);
    });
});
