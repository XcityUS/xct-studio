'use client';

import styles from './index.module.scss';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
    const t = useTranslations();
    const { setTheme, theme } = useTheme();
    const label = t('Switch color theme');

    return (
        <button
            type='button'
            className={styles.button}
            aria-label={label}
            title={label}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            <Sun className={styles.sun} size={15} aria-hidden='true' />
            <Moon className={styles.moon} size={15} aria-hidden='true' />
        </button>
    );
}
