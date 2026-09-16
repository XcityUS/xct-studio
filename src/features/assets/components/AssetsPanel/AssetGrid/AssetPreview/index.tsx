'use client';

import type { AssetListItem } from '../../asset-list';
import styles from './index.module.scss';
import { Library, Music } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export function AssetPreview({ item }: { item: AssetListItem }) {
    const t = useTranslations();
    const { asset, providerAsset } = item;
    const [failed, setFailed] = React.useState(false);

    if (!asset.url || failed) {
        return (
            <div className={styles.unavailable}>
                <Library aria-hidden='true' />
                <span>{t('Preview unavailable')}</span>
                {providerAsset?.assetId && <code>{providerAsset.assetId}</code>}
            </div>
        );
    }
    if (asset.kind === 'image') {
        return (
            // eslint-disable-next-line @next/next/no-img-element -- provider-hosted URL
            <img
                src={asset.url}
                alt={asset.name || asset.key}
                loading='lazy'
                className={styles.media}
                onError={() => setFailed(true)}
            />
        );
    }
    if (asset.kind === 'audio') {
        return (
            <div className={styles.audio}>
                <Music size={30} />
                <audio src={asset.url} controls preload='none' onError={() => setFailed(true)} />
            </div>
        );
    }
    return (
        <video
            src={`${asset.url}#t=0.001`}
            className={styles.media}
            muted
            preload='metadata'
            playsInline
            onError={() => setFailed(true)}
            onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)}
            onMouseLeave={(event) => {
                event.currentTarget.pause();
                event.currentTarget.currentTime = 0;
            }}
        />
    );
}
