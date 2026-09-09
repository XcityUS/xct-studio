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

type AssetLibraryProps = Omit<AssetGridProps, 'items'> & {
    items: AssetListItem[];
    providerAssets: ProviderLibraryAsset[];
    declarations: Record<string, ReferenceDeclaration>;
    isLoading: boolean;
};

type AssetLibraryBodyProps = {
    availableOnly: boolean;
    gridProps: Omit<AssetGridProps, 'items'>;
    isLoading: boolean;
    items: AssetListItem[];
    declarations: Record<string, ReferenceDeclaration>;
    kindFilter: AssetKind;
    onAvailableOnlyChange: (active: boolean) => void;
    onKindFilterChange: (kind: AssetKind) => void;
    source: AssetSource;
    visible: AssetListItem[];
};

function AssetMetrics({
    assets,
    itemCount,
    isLoading
}: {
    assets: ProviderLibraryAsset[];
    itemCount: number;
    isLoading: boolean;
}) {
    const t = useTranslations();
    const activeCount = assets.filter((asset) => asset.status === 'Active').length;
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
                {t('Reviewed')} <strong>{activeCount}</strong>
            </span>
            <span>
                {t('Under review')} <strong>{processingCount}</strong>
            </span>
            {isLoading && <Loader2 className={styles.spinner} aria-label={t('Loading assets')} />}
        </div>
    );
}

function AssetLibraryBody({
    availableOnly,
    gridProps,
    isLoading,
    items,
    declarations,
    kindFilter,
    onAvailableOnlyChange,
    onKindFilterChange,
    source,
    visible
}: AssetLibraryBodyProps) {
    const t = useTranslations();
    if (source === 'seedance') return <OfficialAssetLibrary declarations={declarations} />;
    return (
        <>
            <AssetFilters
                active={kindFilter}
                availableOnly={availableOnly}
                onAvailableOnlyChange={onAvailableOnlyChange}
                onChange={onKindFilterChange}
            />
            {items.length === 0 && isLoading ? (
                <div className={styles.empty}>
                    <Loader2 className={styles.spinner} />
                    {t('Loading assets')}
                </div>
            ) : visible.length === 0 ? (
                <div className={styles.empty}>
                    <p>
                        {items.length > 0
                            ? t('No assets match the current filter')
                            : t('Nothing stored yet<dot> Uploaded references and archived videos will appear here')}
                    </p>
                </div>
            ) : (
                <AssetGrid items={visible} {...gridProps} />
            )}
        </>
    );
}

export function AssetLibrary({ items, providerAssets, declarations, isLoading, ...gridProps }: AssetLibraryProps) {
    const t = useTranslations();
    const [kindFilter, setKindFilter] = React.useState<AssetKind>('all');
    const [availableOnly, setAvailableOnly] = React.useState(false);
    const [source, setSource] = React.useState<AssetSource>('xcity');
    const visible = React.useMemo(
        () =>
            items.filter(
                (item) =>
                    (kindFilter === 'all' || item.asset.kind === kindFilter) &&
                    (!availableOnly || Boolean(item.referenceUrl))
            ),
        [availableOnly, items, kindFilter]
    );
    return (
        <section className={styles.root} aria-labelledby='asset-library-heading'>
            <div className={styles.header}>
                <h3 id='asset-library-heading' className={styles.title}>
                    {t('Assets')}
                </h3>
                {source === 'xcity' && (
                    <AssetMetrics assets={providerAssets} itemCount={items.length} isLoading={isLoading} />
                )}
            </div>

            <AssetSourceTabs active={source} itemCount={items.length} onChange={setSource} />

            <AssetLibraryBody
                availableOnly={availableOnly}
                gridProps={gridProps}
                isLoading={isLoading}
                items={items}
                declarations={declarations}
                kindFilter={kindFilter}
                onAvailableOnlyChange={setAvailableOnly}
                onKindFilterChange={setKindFilter}
                source={source}
                visible={visible}
            />
        </section>
    );
}
