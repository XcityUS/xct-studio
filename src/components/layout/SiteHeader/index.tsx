import styles from './index.module.scss';
import { LocaleSwitcher } from '@/features/settings/components/LocaleSwitcher';
import { ThemeToggle } from '@/features/settings/components/ThemeToggle';
import type { AppLocale } from '@/i18n/routing';
import { UserRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

export async function SiteHeader({ locale }: { locale: AppLocale }) {
    const t = await getTranslations({ locale });
    const links = [
        { label: t('Dashboard'), href: 'https://xcity.ai/dashboard' },
        { label: t('Models'), href: 'https://xcity.ai/models' },
        { label: t('Chat'), href: 'https://chat.xcity.ai' },
        { label: t('Docs'), href: 'https://xcity.ai/docs' }
    ];
    return (
        <header className={styles.header}>
            <div className={styles.headerInner}>
                <a href='https://xcity.ai' className={styles.brand}>
                    <Image src='/logo.png' alt='Xcity' width={26} height={27} priority />
                    <span className={styles.wordmark}>Xcity</span>
                    <span className={styles.product}>{t('Video Studio')}</span>
                </a>
                <nav aria-label={t('Main navigation')} className={styles.navigation}>
                    {links.map((link) => (
                        <a key={link.href} href={link.href} rel='noopener' className={styles.navigationLink}>
                            {link.label}
                        </a>
                    ))}
                    <div className={styles.utilities}>
                        <LocaleSwitcher />
                        <ThemeToggle />
                        <a href='https://xcity.ai/dashboard' rel='noopener' className={styles.account}>
                            <UserRound size={15} aria-hidden='true' />
                            <span>{t('My Account')}</span>
                        </a>
                    </div>
                </nav>
            </div>
        </header>
    );
}
