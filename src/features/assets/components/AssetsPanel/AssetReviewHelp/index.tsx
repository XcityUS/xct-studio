'use client';

import styles from './index.module.scss';
import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function AssetReviewHelp() {
    const t = useTranslations();
    return (
        <details className={styles.root}>
            <summary aria-label={t('About asset review')} title={t('About asset review')}>
                <HelpCircle aria-hidden='true' />
            </summary>
            <p>
                {t(
                    'Studio<dash>generated images can be used directly<dot> Other materials are reviewed automatically before video generation'
                )}
            </p>
        </details>
    );
}
