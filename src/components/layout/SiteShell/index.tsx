import styles from './index.module.scss';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import type { AppLocale } from '@/i18n/routing';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export async function SiteShell({ children, locale }: { children: React.ReactNode; locale: AppLocale }) {
    const messages = await getMessages({ locale });

    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <div className={styles.frame}>
                <SiteHeader locale={locale} />
                <div className={styles.content}>{children}</div>
                <SiteFooter locale={locale} />
            </div>
        </NextIntlClientProvider>
    );
}
