'use client';

import styles from './index.module.scss';
import { useTranslations } from 'next-intl';

export function ProviderErrorNotice({ error }: { error: string }) {
    const t = useTranslations();
    const limited = error === 'PROVIDER_RATE_LIMITED' || error.includes('asset service is rate-limited');
    return (
        <p className={styles.notice} role='status'>
            {limited
                ? t('Asset service is busy<dot> Your saved assets are safe<dot> Please refresh shortly')
                : t('Could not complete the asset action<dot> Please retry')}
        </p>
    );
}
