'use client';

import type { PortraitGroupQueryType, ProviderLibraryAsset } from '@/features/assets/portrait/api';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Options = {
    active: boolean;
    enabled: boolean;
    loadAssets: (type?: PortraitGroupQueryType) => Promise<ProviderLibraryAsset[]>;
};

export function useProviderAssetList({ active, enabled, loadAssets }: Options) {
    const t = useTranslations();
    const unknownError = t('Unknown error');
    const [assets, setAssets] = React.useState<ProviderLibraryAsset[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasLoaded, setHasLoaded] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const refresh = React.useCallback(async () => {
        if (!enabled) return;
        setIsLoading(true);
        setError(null);
        try {
            setAssets(await loadAssets('all'));
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : unknownError);
        } finally {
            setIsLoading(false);
            setHasLoaded(true);
        }
    }, [enabled, loadAssets, unknownError]);

    const upsertAsset = React.useCallback((asset: ProviderLibraryAsset) => {
        setAssets((current) => {
            const next = current.filter((item) => item.assetId !== asset.assetId);
            return [asset, ...next];
        });
        setHasLoaded(true);
    }, []);

    const fetchedRef = React.useRef(false);
    React.useEffect(() => {
        if (!active || !enabled || fetchedRef.current) return;
        fetchedRef.current = true;
        void refresh();
    }, [active, enabled, refresh]);

    return { assets, error, hasLoaded, isLoading, refresh, upsertAsset };
}
