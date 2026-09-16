import { refreshProjectAssetStatus } from '@/features/assets/portrait/refresh-project-asset';
import type { VideoPortrait } from '@/features/generation/history/merge';
import { describe, expect, it, vi } from 'vitest';

const portrait: VideoPortrait = {
    assetId: 'asset-1', groupId: 'group-1', groupType: 'AIGC',
    name: 'Character', thumbUrl: 'https://media.example/old.png',
    status: 'Processing', updatedAt: 1
};

describe('refreshing a storyboard Project Asset', () => {
    it('updates both the project binding and cached portrait when review becomes active', async () => {
        const savePortrait = vi.fn();
        const syncProjectStatuses = vi.fn();
        const syncPortraitState = vi.fn(async () => {});
        const status = await refreshProjectAssetStatus({
            assetId: 'asset-1', portraits: [portrait], savePortrait,
            syncProjectStatuses, syncPortraitState,
            getAsset: vi.fn(async () => ({ assetId: 'asset-1', groupId: 'group-1', status: 'Active', previewUrl: 'https://media.example/new.png', failureReason: '' }))
        });

        expect(status).toBe('active');
        expect(syncProjectStatuses).toHaveBeenCalledWith({ 'asset-1': 'active' });
        expect(savePortrait).toHaveBeenCalledWith(expect.objectContaining({ status: 'Active', thumbUrl: 'https://media.example/new.png' }));
        expect(syncPortraitState).toHaveBeenCalledTimes(1);
    });

    it.each([['Processing', 'reviewing'], ['Failed', 'failed']] as const)(
        'maps %s to %s without resubmitting the asset', async (providerStatus, expectedStatus) => {
            const syncProjectStatuses = vi.fn();
            const syncPortraitState = vi.fn(async () => {});
            const status = await refreshProjectAssetStatus({
                assetId: 'asset-1', portraits: [], savePortrait: vi.fn(),
                syncProjectStatuses, syncPortraitState,
                getAsset: vi.fn(async () => ({ assetId: 'asset-1', groupId: 'group-1', status: providerStatus, previewUrl: '', failureReason: '' }))
            });
            expect(status).toBe(expectedStatus);
            expect(syncProjectStatuses).toHaveBeenCalledWith({ 'asset-1': expectedStatus });
            expect(syncPortraitState).not.toHaveBeenCalled();
        }
    );

    it('leaves existing status unchanged when the provider query fails', async () => {
        const syncProjectStatuses = vi.fn();
        await expect(refreshProjectAssetStatus({
            assetId: 'asset-1', portraits: [], savePortrait: vi.fn(),
            syncProjectStatuses, syncPortraitState: vi.fn(async () => {}),
            getAsset: vi.fn(async () => { throw new Error('network failed'); })
        })).rejects.toThrow('network failed');
        expect(syncProjectStatuses).not.toHaveBeenCalled();
    });
});
