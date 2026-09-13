'use client';

import styles from './index.module.scss';
import { studioPath, studioTabFromPathname } from '@/features/studio/routing';
import type { AppLocale } from '@/i18n/routing';
import { ImageIcon, PanelsTopLeft, UsersRound, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Props = {
    locale: AppLocale;
};

export function StudioHeaderMenu({ locale }: Props) {
    const t = useTranslations();
    const pathname = usePathname();
    const activeTab = studioTabFromPathname(pathname);
    const items = [
        { tab: 'video' as const, label: t('Video'), icon: Video },
        { tab: 'image' as const, label: t('Image'), icon: ImageIcon },
        { tab: 'assets' as const, label: t('Assets'), icon: PanelsTopLeft },
        { tab: 'community' as const, label: t('Community'), icon: UsersRound }
    ];

    return (
        <nav className={styles.menu} aria-label={t('Studio navigation')}>
            {items.map((item) => (
                <Link
                    key={item.tab}
                    href={studioPath(locale, item.tab)}
                    className={styles.item}
                    data-active={activeTab === item.tab}
                    aria-label={item.label}
                    title={item.label}>
                    <item.icon aria-hidden='true' />
                    <span>{item.label}</span>
                </Link>
            ))}
        </nav>
    );
}
