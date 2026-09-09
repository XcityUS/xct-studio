'use client';

import { storedPortraitAssetStatus, type PortraitAsset } from '@/features/assets/portrait/api';
import type { VideoPortrait } from '@/features/generation/history/merge';
import * as React from 'react';

type ProcessingPortraitRefreshOptions = {
    active: boolean;
    enabled: boolean;
    portraits: VideoPortrait[];
    getAsset: (assetId: string) => Promise<PortraitAsset>;
    savePortrait: (portrait: VideoPortrait) => void;
    syncState: () => Promise<void>;
};

export function useProcessingPortraitRefresh(options: ProcessingPortraitRefreshOptions): void {
    const { active, enabled, portraits, getAsset, savePortrait, syncState } = options;
    const processingPortraits = React.useMemo(
        () => portraits.filter((portrait) => portrait.status === 'Processing'),
        [portraits]
    );

    React.useEffect(() => {
        if (!active || !enabled || processingPortraits.length === 0) return;

        let cancelled = false;
        const refresh = async () => {
            const results = await Promise.allSettled(
                processingPortraits.map(async (portrait) => {
                    const asset = await getAsset(portrait.assetId);
                    const status = storedPortraitAssetStatus(asset.status);
                    if (
                        cancelled ||
                        (status === portrait.status && asset.failureReason === (portrait.failureReason ?? ''))
                    ) {
                        return false;
                    }
                    savePortrait({
                        ...portrait,
                        status,
                        failureReason: asset.failureReason,
                        updatedAt: Date.now()
                    });
                    return true;
                })
            );
            if (!cancelled && results.some((result) => result.status === 'fulfilled' && result.value)) {
                await syncState();
            }
        };

        void refresh();
        const timer = window.setInterval(() => void refresh(), 5000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [active, enabled, getAsset, processingPortraits, savePortrait, syncState]);
}
