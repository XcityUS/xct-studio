'use client';

import styles from './index.module.scss';
import { routing } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';

function replaceLocale(pathname: string, locale: string): string {
    const segments = pathname.split('/');
    if (routing.locales.some((candidate) => candidate === segments[1])) {
        segments[1] = locale;
        return segments.join('/');
    }
    return `/${locale}${pathname === '/' ? '' : pathname}`;
}

export function LocaleSwitcher() {
    const locale = useLocale();
    const t = useTranslations();
    const pathname = usePathname();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const nextLocale = locale === 'zh' ? 'en' : 'zh';
    const nextLabel = nextLocale === 'zh' ? '中' : 'EN';
    const accessibleLabel = nextLocale === 'zh' ? t('Switch to Chinese') : t('Switch to English');

    useEffect(() => {
        // The shared root document persists across locale-segment navigation.
        document.documentElement.lang = locale;
    }, [locale]);

    return (
        <div className={styles.control}>
            <button
                type='button'
                className={styles.button}
                aria-label={accessibleLabel}
                aria-busy={isPending}
                disabled={isPending}
                title={accessibleLabel}
                lang={nextLocale}
                onClick={() => {
                    const localizedPath = replaceLocale(pathname, nextLocale);
                    const href = `${localizedPath}${window.location.search}${window.location.hash}`;
                    startTransition(() => router.replace(href, { scroll: false }));
                }}>
                <span>{nextLabel}</span>
            </button>
            <span role='status' className={styles.status}>
                {isPending ? t('Changing language') : ''}
            </span>
        </div>
    );
}
