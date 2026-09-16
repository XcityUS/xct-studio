'use client';

import { AssetFilters, type AssetKind } from '../AssetFilters';
import { AssetGrid, type AssetGridProps } from '../AssetGrid';
import type { AssetListItem } from '../asset-list';
import styles from './index.module.scss';
import type { ProviderLibraryAsset } from '@/features/assets/portrait/api';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const ASSET_BATCH_SIZE = 15;

type AssetLibraryProps = Omit<AssetGridProps, 'items'> & {
    items: AssetListItem[];
    providerAssets: ProviderLibraryAsset[];
    isLoading: boolean;
};

type AssetLibraryBodyProps = {
    availableOnly: boolean;
    gridProps: Omit<AssetGridProps, 'items'>;
    isLoading: boolean;
    items: AssetListItem[];
    kindFilter: AssetKind;
    onAvailableOnlyChange: (active: boolean) => void;
    onKindFilterChange: (kind: AssetKind) => void;
    visible: AssetListItem[];
    visibleCount: number;
    isLoadingNextPage: boolean;
    loadMoreRef: React.RefObject<HTMLDivElement | null>;
};

function AssetGridSkeleton({ count }: { count: number }) {
    return (
        <div className={styles.skeletonGrid} aria-hidden='true'>
            {Array.from({ length: count }).map((_, index) => (
                <div className={styles.skeletonCard} key={`asset-skeleton-${index}`}>
                    <div className={styles.skeletonPreview} />
                    <div className={styles.skeletonActions}>
                        <div />
                        <div />
                        <div />
                    </div>
                </div>
            ))}
        </div>
    );
}

function AssetMetrics({
    assets,
    availableCount,
    itemCount,
    isLoading
}: {
    assets: ProviderLibraryAsset[];
    availableCount: number;
    itemCount: number;
    isLoading: boolean;
}) {
    const t = useTranslations();
    const processingCount = assets.filter((asset) => asset.status === 'Processing').length;
    return (
        <div className={styles.metrics} aria-live='polite'>
            <span>
                {t('Assets')} <strong>{itemCount}</strong>
            </span>
            <span>
                {t('Approved Asset IDs')} <strong>{assets.length}</strong>
            </span>
            <span>
                {t('Available assets')} <strong>{availableCount}</strong>
            </span>
            <span>
                {t('Under review')} <strong>{processingCount}</strong>
            </span>
            {isLoading && <Loader2 className={styles.spinner} aria-label={t('Loading assets')} />}
        </div>
    );
}

function AssetLibraryEmpty({ hasItems, isLoading }: { hasItems: boolean; isLoading: boolean }) {
    const t = useTranslations();
    if (isLoading && !hasItems) {
        return (
            <div className={styles.empty}>
                <Loader2 className={styles.spinner} />
                {t('Loading assets')}
            </div>
        );
    }
    return (
        <div className={styles.empty}>
            <p>
                {hasItems
                    ? t('No assets match the current filter')
                    : t('Nothing stored yet<dot> Uploaded references and archived videos will appear here')}
            </p>
        </div>
    );
}

function AssetLibraryBody({
    availableOnly,
    gridProps,
    isLoading,
    items,
    kindFilter,
    onAvailableOnlyChange,
    onKindFilterChange,
    visible,
    visibleCount,
    isLoadingNextPage,
    loadMoreRef
}: AssetLibraryBodyProps) {
    return (
        <>
            <AssetFilters
                active={kindFilter}
                availableOnly={availableOnly}
                onAvailableOnlyChange={onAvailableOnlyChange}
                onChange={onKindFilterChange}
            />
            {visible.length === 0 ? (
                isLoading ? (
                    <AssetGridSkeleton count={ASSET_BATCH_SIZE} />
                ) : (
                    <AssetLibraryEmpty hasItems={items.length > 0} isLoading={isLoading} />
                )
            ) : (
                <>
                    <AssetGrid items={visible.slice(0, visibleCount)} {...gridProps} />
                    {isLoadingNextPage && (
                        <AssetGridSkeleton count={Math.min(ASSET_BATCH_SIZE, visible.length - visibleCount)} />
                    )}
                    <div ref={loadMoreRef} className={styles.loadMoreSentinel} aria-hidden='true' />
                </>
            )}
        </>
    );
}

export function AssetLibrary(props: AssetLibraryProps) {
    const { items, providerAssets, isLoading, ...gridProps } = props;
    const t = useTranslations();
    const [kindFilter, setKindFilter] = React.useState<AssetKind>('all');
    const [availableOnly, setAvailableOnly] = React.useState(false);
    const [visibleCount, setVisibleCount] = React.useState(ASSET_BATCH_SIZE);
    const [isLoadingNextPage, setIsLoadingNextPage] = React.useState(false);
    const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
    const loadingTimerRef = React.useRef<number | null>(null);
    const visible = React.useMemo(
        () =>
            items.filter(
                (item) =>
                    (kindFilter === 'all' || item.asset.kind === kindFilter) &&
                    (!availableOnly || Boolean(item.referenceUrl))
            ),
        [availableOnly, items, kindFilter]
    );
    const availableCount = React.useMemo(() => items.filter((item) => Boolean(item.referenceUrl)).length, [items]);
    const metricProps = { assets: providerAssets, availableCount, itemCount: items.length, isLoading };
    const displayedCount = Math.min(visibleCount, visible.length);
    const hasMoreAssets = displayedCount < visible.length;

    const resetPagination = () => {
        setVisibleCount(ASSET_BATCH_SIZE);
        setIsLoadingNextPage(false);
        if (loadingTimerRef.current) {
            window.clearTimeout(loadingTimerRef.current);
            loadingTimerRef.current = null;
        }
    };

    const handleAvailableOnlyChange = (next: boolean) => {
        setAvailableOnly(next);
        resetPagination();
    };

    const handleKindFilterChange = (next: AssetKind) => {
        setKindFilter(next);
        resetPagination();
    };

    const loadMoreAssets = React.useCallback(() => {
        if (!hasMoreAssets || isLoadingNextPage) return;
        setIsLoadingNextPage(true);
        if (loadingTimerRef.current) {
            window.clearTimeout(loadingTimerRef.current);
            loadingTimerRef.current = null;
        }
        loadingTimerRef.current = window.setTimeout(() => {
            setVisibleCount((current) => Math.min(current + ASSET_BATCH_SIZE, visible.length));
            setIsLoadingNextPage(false);
            loadingTimerRef.current = null;
        }, 180);
    }, [hasMoreAssets, isLoadingNextPage, visible.length]);

    React.useEffect(() => {
        if (!hasMoreAssets) return;
        const target = loadMoreRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) loadMoreAssets();
            },
            { root: null, rootMargin: '160px 0px', threshold: 0 }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMoreAssets, loadMoreAssets]);

    React.useEffect(() => {
        return () => {
            if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
        };
    }, []);

    return (
        <section className={styles.root} aria-labelledby='asset-library-heading'>
            <div className={styles.header}>
                <h3 id='asset-library-heading' className={styles.title}>
                    {t('Assets')}
                </h3>
                <AssetMetrics {...metricProps} />
            </div>

            <AssetLibraryBody
                availableOnly={availableOnly}
                gridProps={gridProps}
                isLoading={isLoading}
                items={items}
                kindFilter={kindFilter}
                onAvailableOnlyChange={handleAvailableOnlyChange}
                onKindFilterChange={handleKindFilterChange}
                visible={visible}
                visibleCount={displayedCount}
                isLoadingNextPage={isLoadingNextPage}
                loadMoreRef={loadMoreRef}
            />
        </section>
    );
}
