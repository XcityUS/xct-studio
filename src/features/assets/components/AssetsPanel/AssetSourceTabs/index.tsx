'use client';

import styles from './index.module.scss';
import { Library } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type AssetSource = 'xcity' | 'seedance';

type AssetSourceTabsProps = {
    active: AssetSource;
    itemCount: number;
    onChange: (source: AssetSource) => void;
};

export function AssetSourceTabs({ active, itemCount, onChange }: AssetSourceTabsProps) {
    const t = useTranslations();
    return (
        <div className={styles.root} aria-label={t('Asset source')}>
            <button
                type='button'
                aria-pressed={active === 'xcity'}
                onClick={() => onChange('xcity')}
                className={active === 'xcity' ? styles.active : styles.tab}>
                {t('My Xcity assets')}
                <strong>{itemCount}</strong>
            </button>
            <button
                type='button'
                aria-pressed={active === 'seedance'}
                onClick={() => onChange('seedance')}
                className={active === 'seedance' ? styles.active : styles.tab}>
                <Library aria-hidden='true' />
                {t('Seedance official asset library')}
            </button>
        </div>
    );
}
