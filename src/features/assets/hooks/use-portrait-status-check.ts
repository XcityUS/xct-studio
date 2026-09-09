'use client';

import { storedPortraitAssetStatus, type PortraitAsset } from '@/features/assets/portrait/api';
import type { VideoPortrait, VideoPortraitStatus } from '@/features/generation/history/merge';
import * as React from 'react';

type Options = {
    getAsset: (assetId: string) => Promise<PortraitAsset>;
    refreshProviderAssets: () => Promise<void>;
    savePortrait: (portrait: VideoPortrait) => void;
    syncState: () => Promise<void>;
};

export function usePortraitStatusCheck(options: Options) {
    const { getAsset, refreshProviderAssets, savePortrait, syncState } = options;
    const [checkingAssetId, setCheckingAssetId] = React.useState<string | null>(null);

    const checkStatus = React.useCallback(
        async (portrait: VideoPortrait): Promise<VideoPortraitStatus> => {
            setCheckingAssetId(portrait.assetId);
            try {
                const asset = await getAsset(portrait.assetId);
                const status = storedPortraitAssetStatus(asset.status);
                savePortrait({
                    ...portrait,
                    groupId: asset.groupId || portrait.groupId,
                    thumbUrl: asset.previewUrl || portrait.thumbUrl,
                    status,
                    failureReason: asset.failureReason,
                    updatedAt: Date.now()
                });
                await syncState();
                await refreshProviderAssets();
                return status;
            } finally {
                setCheckingAssetId(null);
            }
        },
        [getAsset, refreshProviderAssets, savePortrait, syncState]
    );

    return { checkStatus, checkingAssetId };
}
