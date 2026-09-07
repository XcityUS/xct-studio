'use client';

import { PortraitAssetStatus } from '../PortraitAssetStatus';
import styles from './index.module.scss';
import type { VideoPortrait } from '@/features/generation/history/merge';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type AssetStripProps = {
    assets: VideoPortrait[];
    kind: 'reviewed' | 'verified' | 'virtual';
    onRemove: (assetId: string) => void;
};

export function AssetStrip({ assets, kind, onRemove }: AssetStripProps) {
    const t = useTranslations();
    if (assets.length === 0) return null;

    const removeLabel =
        kind === 'verified'
            ? t('Remove verified photo')
            : kind === 'reviewed'
              ? t('Remove reviewed material')
              : t('Remove virtual character image');

    return (
        <div className={styles.root}>
            {assets.map((asset) => (
                <div className={styles.item} data-kind={kind} key={asset.assetId}>
                    <div className={styles.preview}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- worker-hosted URL */}
                        <img src={asset.thumbUrl} alt={asset.name} loading='lazy' />
                    </div>
                    <div className={styles.details}>
                        <div className={styles.name}>{asset.name}</div>
                        <PortraitAssetStatus portrait={asset} />
                    </div>
                    <button
                        className={styles.remove}
                        type='button'
                        title={removeLabel}
                        aria-label={`${removeLabel}: ${asset.name}`}
                        onClick={() => onRemove(asset.assetId)}>
                        <Trash2 aria-hidden='true' />
                    </button>
                </div>
            ))}
        </div>
    );
}
