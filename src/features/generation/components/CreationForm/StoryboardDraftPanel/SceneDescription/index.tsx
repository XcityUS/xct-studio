'use client';

import styles from './index.module.scss';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export function SceneDescription({ description }: { description: string }) {
    const t = useTranslations();
    const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'failed'>('idle');
    const label =
        copyState === 'copied' ? t('Copied') : copyState === 'failed' ? t('Copy failed') : t('Copy scene description');

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(description);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
    };

    return (
        <div className={styles.root}>
            <span className={styles.text} title={description || t('No description')}>
                {description || t('No description')}
            </span>
            {description && (
                <button
                    type='button'
                    className={styles.copyButton}
                    aria-label={label}
                    title={label}
                    onClick={() => void copy()}>
                    {copyState === 'copied' ? (
                        <Check size={15} aria-hidden='true' />
                    ) : (
                        <Copy size={15} aria-hidden='true' />
                    )}
                </button>
            )}
        </div>
    );
}
