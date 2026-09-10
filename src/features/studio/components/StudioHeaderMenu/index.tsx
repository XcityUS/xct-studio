'use client';

import styles from './index.module.scss';
import { studioPath, studioTabFromPathname } from '@/features/studio/routing';
import type { AppLocale } from '@/i18n/routing';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

type Props = {
    locale: AppLocale;
};

export function StudioHeaderMenu({ locale }: Props) {
    const t = useTranslations();
    const pathname = usePathname();
    const activeTab = studioTabFromPathname(pathname);
    const items = [
        { tab: 'video' as const, label: t('Video') },
        { tab: 'image' as const, label: t('Image') },
        { tab: 'assets' as const, label: t('Assets') },
        { tab: 'community' as const, label: t('Community') }
    ];

    return (
        <nav className={styles.menu} aria-label={t('Studio navigation')}>
            {items.map((item) => (
                <Link
                    key={item.tab}
                    href={studioPath(locale, item.tab)}
                    className={styles.item}
                    data-active={activeTab === item.tab}>
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
