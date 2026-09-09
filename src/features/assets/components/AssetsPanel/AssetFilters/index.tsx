'use client';

import styles from './index.module.scss';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type AssetKind = 'all' | 'image' | 'audio' | 'video';

type AssetFiltersProps = {
    active: AssetKind;
    availableOnly: boolean;
    onAvailableOnlyChange: (active: boolean) => void;
    onChange: (kind: AssetKind) => void;
};

export function AssetFilters({ active, availableOnly, onAvailableOnlyChange, onChange }: AssetFiltersProps) {
    const t = useTranslations();
    const labels = { all: t('All'), image: t('Images'), audio: t('Audio'), video: t('Videos') };
    return (
        <div className={styles.root}>
            {(Object.keys(labels) as AssetKind[]).map((kind) => (
                <button
                    key={kind}
                    type='button'
                    aria-pressed={active === kind}
                    onClick={() => onChange(kind)}
                    className={active === kind ? styles.active : styles.filter}>
                    {labels[kind]}
                </button>
            ))}
            <span className={styles.divider} aria-hidden='true' />
            <button
                type='button'
                aria-pressed={availableOnly}
                onClick={() => onAvailableOnlyChange(!availableOnly)}
                className={availableOnly ? styles.active : styles.filter}>
                <ShieldCheck aria-hidden='true' />
                {t('Available assets')}
            </button>
        </div>
    );
}
