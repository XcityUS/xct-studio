'use client';

import { AssetFilters, type AssetKind } from '../AssetFilters';
import { AssetGrid, type AssetGridProps } from '../AssetGrid';
import { AssetSourceTabs, type AssetSource } from '../AssetSourceTabs';
import { OfficialAssetLibrary } from '../OfficialAssetLibrary';
import type { AssetListItem } from '../asset-list';
import styles from './index.module.scss';
import type { ProviderLibraryAsset } from '@/features/assets/portrait/api';
import type { ReferenceDeclaration } from '@/features/assets/reference/origin';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const ASSET_BATCH_SIZE = 15;

type AssetLibraryProps = Omit<AssetGridProps, 'items'> & {
    items: AssetListItem[];
    providerAssets: ProviderLibraryAsset[];
    declarations: Record<string, ReferenceDeclaration>;
    referenceImageUrls: string[];
    onUpdateOfficialAssetNote: (key: string, note: string) => void;
    isLoading: boolean;
};

type AssetLibraryBodyProps = {
    availableOnly: boolean;
    referenceImageUrls: string[];
    gridProps: Omit<AssetGridProps, 'items'>;
    isLoading: boolean;
    items: AssetListItem[];
    declarations: Record<string, ReferenceDeclaration>;
    kindFilter: AssetKind;
    onAvailableOnlyChange: (active: boolean) => void;
    onKindFilterChange: (kind: AssetKind) => void;
    onUpdateOfficialAssetNote: (key: string, note: string) => void;
    source: AssetSource;
    visible: AssetListItem[];
    visibleCount: number;
    isLoadingNextPage: boolean;
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
                {t('Provider Asset IDs')} <strong>{assets.length}</strong>
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
    referenceImageUrls,
    gridProps,
    isLoading,
    items,
    declarations,
    kindFilter,
    onAvailableOnlyChange,
    onKindFilterChange,
    onUpdateOfficialAssetNote,
    source,
    visible,
    visibleCount,
    isLoadingNextPage
}: AssetLibraryBodyProps) {
    if (source === 'seedance') {
        return (
            <OfficialAssetLibrary
                declarations={declarations}
                onUseImage={gridProps.onUseImage}
                onUpdateNote={onUpdateOfficialAssetNote}
                referenceImageUrls={referenceImageUrls}
            />
        );
    }
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
                </>
            )}
        </>
    );
}

export function AssetLibrary(props: AssetLibraryProps) {
    const { items, providerAssets, declarations, isLoading, referenceImageUrls, onUpdateOfficialAssetNote, ...gridProps } =
        props;
    const t = useTranslations();
    const [kindFilter, setKindFilter] = React.useState<AssetKind>('all');
    const [availableOnly, setAvailableOnly] = React.useState(false);
    const [source, setSource] = React.useState<AssetSource>('xcity');
    const [visibleCount, setVisibleCount] = React.useState(ASSET_BATCH_SIZE);
    const [isLoadingNextPage, setIsLoadingNextPage] = React.useState(false);
    const rootRef = React.useRef<HTMLElement | null>(null);
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
    const hasMoreAssets = source === 'xcity' && visibleCount < visible.length;

    React.useEffect(() => {
        setVisibleCount(Math.min(ASSET_BATCH_SIZE, visible.length));
        setIsLoadingNextPage(false);
        if (loadingTimerRef.current) {
            window.clearTimeout(loadingTimerRef.current);
            loadingTimerRef.current = null;
        }
    }, [availableOnly, kindFilter, source, visible.length]);

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
        const root = rootRef.current;
        if (!root) return;
        const scrollParent = root.closest('.overflow-y-auto');

        const handleScroll = () => {
            if (scrollParent instanceof HTMLElement) {
                const remaining = scrollParent.scrollHeight - scrollParent.scrollTop - scrollParent.clientHeight;
                if (remaining <= 160) loadMoreAssets();
                return;
            }

            const remaining = root.getBoundingClientRect().bottom - window.innerHeight;
            if (remaining <= 160) loadMoreAssets();
        };

        if (scrollParent instanceof HTMLElement) {
            scrollParent.addEventListener('scroll', handleScroll, { passive: true });
            return () => scrollParent.removeEventListener('scroll', handleScroll);
        }

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
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
        <section ref={rootRef} className={styles.root} aria-labelledby='asset-library-heading'>
            <div className={styles.header}>
                <h3 id='asset-library-heading' className={styles.title}>
                    {t('Assets')}
                </h3>
                {source === 'xcity' && <AssetMetrics {...metricProps} />}
            </div>

            <AssetSourceTabs active={source} itemCount={items.length} onChange={setSource} />

            <AssetLibraryBody
                availableOnly={availableOnly}
                declarations={declarations}
                gridProps={gridProps}
                isLoading={isLoading}
                items={items}
                kindFilter={kindFilter}
                onAvailableOnlyChange={setAvailableOnly}
                onKindFilterChange={setKindFilter}
                onUpdateOfficialAssetNote={onUpdateOfficialAssetNote}
                referenceImageUrls={referenceImageUrls}
                source={source}
                visible={visible}
                visibleCount={visibleCount}
                isLoadingNextPage={isLoadingNextPage}
            />
        </section>
    );
}
