import { storedPortraitAssetStatus, waitForPortraitAsset, type PortraitAsset } from './api';
import type { VideoPortrait } from '@/features/generation/history/merge';

type TrackPortraitAssetInput = Omit<VideoPortrait, 'assetId' | 'status' | 'failureReason' | 'updatedAt'>;

export async function createAndTrackPortraitAsset(
    input: TrackPortraitAssetInput,
    createAsset: () => Promise<{ assetId: string; status: 'Processing' }>,
    getAsset: (assetId: string) => Promise<PortraitAsset>,
    savePortrait: (portrait: VideoPortrait) => void,
    syncState: () => Promise<void>
): Promise<PortraitAsset> {
    const created = await createAsset();
    const save = (status: VideoPortrait['status'], failureReason?: string) =>
        savePortrait({
            ...input,
            assetId: created.assetId,
            status,
            ...(failureReason ? { failureReason } : {}),
            updatedAt: Date.now()
        });

    save(created.status);
    await syncState();
    try {
        const asset = await waitForPortraitAsset(created.assetId, getAsset);
        save(storedPortraitAssetStatus(asset.status), asset.failureReason);
        await syncState();
        return asset;
    } catch (error) {
        try {
            const asset = await getAsset(created.assetId);
            save(storedPortraitAssetStatus(asset.status), asset.failureReason);
            await syncState();
        } catch {
            // Preserve the original polling error when the final reconciliation also fails.
        }
        throw error;
    }
}
