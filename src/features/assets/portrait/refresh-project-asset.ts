import { storedPortraitAssetStatus, type PortraitAsset } from './api';
import type { VideoPortrait } from '@/features/generation/history/merge';
import type { ProjectAsset } from '@/shared/contracts/production';

type Input = {
    assetId: string;
    getAsset: (assetId: string) => Promise<PortraitAsset>;
    portraits: VideoPortrait[];
    savePortrait: (portrait: VideoPortrait) => void;
    syncPortraitState: () => Promise<void>;
    syncProjectStatuses: (statuses: Record<string, ProjectAsset['status']>) => void;
};

export async function refreshProjectAssetStatus(input: Input): Promise<ProjectAsset['status']> {
    const asset = await input.getAsset(input.assetId);
    const portraitStatus = storedPortraitAssetStatus(asset.status);
    const projectStatus = portraitStatus === 'Active' ? 'active' : portraitStatus === 'Failed' ? 'failed' : 'reviewing';
    const existingPortrait = input.portraits.find((portrait) => portrait.assetId === input.assetId);
    if (existingPortrait) {
        input.savePortrait({
            ...existingPortrait,
            groupId: asset.groupId || existingPortrait.groupId,
            thumbUrl: asset.previewUrl || existingPortrait.thumbUrl,
            status: portraitStatus,
            failureReason: asset.failureReason,
            updatedAt: Date.now()
        });
    }
    input.syncProjectStatuses({ [input.assetId]: projectStatus });
    if (existingPortrait) await input.syncPortraitState();
    return projectStatus;
}
