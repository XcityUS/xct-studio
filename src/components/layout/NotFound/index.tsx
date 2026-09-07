import styles from './index.module.scss';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export async function NotFound() {
    const t = await getTranslations();

    return (
        <main className={styles.root}>
            <h1>{t('Page not found')}</h1>
            <p>{t('This page or language is not available')}</p>
            <Link href='/'>{t('Return to studio')}</Link>
        </main>
    );
}
