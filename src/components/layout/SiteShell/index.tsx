import styles from './index.module.scss';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { LocaleMessages } from '@/components/providers/LocaleMessages';
import type { AppLocale } from '@/i18n/routing';
import { getMessages, getNow, getTimeZone } from 'next-intl/server';

export async function SiteShell({ children, locale }: { children: React.ReactNode; locale: AppLocale }) {
    const messages = await getMessages({ locale });
    const now = await getNow();
    const timeZone = await getTimeZone();

    return (
        <LocaleMessages locale={locale} messages={messages} now={now} timeZone={timeZone}>
            <div className={styles.frame}>
                <SiteHeader locale={locale} />
                <div className={styles.content}>{children}</div>
                <SiteFooter locale={locale} />
            </div>
        </LocaleMessages>
    );
}
