import styles from './index.module.scss';
import type { AppLocale } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';

export async function SiteFooter({ locale }: { locale: AppLocale }) {
    const t = await getTranslations({ locale });
    const columns = [
        {
            title: t('Platform'),
            links: [
                { name: t('AI Platform'), href: 'https://xcity.ai/ai-platform' },
                { name: t('Models'), href: 'https://xcity.ai/models' },
                { name: t('Agents'), href: 'https://xcity.ai/agents' },
                { name: t('Pricing'), href: 'https://xcity.ai/pricing' }
            ]
        },
        {
            title: t('Products'),
            links: [
                { name: t('Video Studio'), href: `/${locale}` },
                { name: t('Xcity Chat'), href: 'https://chat.xcity.ai' },
                { name: t('Dashboard'), href: 'https://xcity.ai/dashboard' },
                { name: t('API Keys'), href: 'https://xcity.ai/dashboard/keys' }
            ]
        },
        {
            title: t('Legal'),
            links: [
                { name: t('Terms'), href: 'https://xcity.ai/terms' },
                { name: t('Privacy'), href: 'https://xcity.ai/privacy' },
                { name: t('Acceptable Use'), href: 'https://xcity.ai/acceptable-use' },
                { name: t('Refund Policy'), href: 'https://xcity.ai/refund-policy' }
            ]
        }
    ];

    return (
        <footer className={styles.footer} data-site-footer>
            <div className={styles.footerInner}>
                <div className={styles.columns}>
                    {columns.map((col) => (
                        <div key={col.title}>
                            <h5 className={styles.columnTitle}>{col.title}</h5>
                            <ul className={styles.linkList}>
                                {col.links.map((link) => (
                                    <li key={link.name}>
                                        <a href={link.href} rel='noopener' className={styles.footerLink}>
                                            {link.name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className={styles.footerBottom}>
                    <p>
                        {t('<copy> <lcur>year<rcur> Xcity<dot> All rights reserved', {
                            year: String(new Date().getFullYear())
                        })}
                    </p>
                    <p>
                        {t('Video generation powered by')}{' '}
                        <a href='https://xcity.ai/models' rel='noopener' className={styles.footerLink}>
                            Xcity Studio
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
}
