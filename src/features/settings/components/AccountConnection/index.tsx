'use client';

import styles from './index.module.scss';
import { Button } from '@/components/ui/Button';
import { xcityLoginHref } from '@/features/settings/sso';
import { useTranslations } from 'next-intl';

interface AccountConnectionProps {
    checking: boolean;
    error: string | null;
    onRetry: () => void;
    onConfigure?: () => void;
}

export function AccountConnection({ checking, error, onRetry, onConfigure }: AccountConnectionProps) {
    const t = useTranslations();
    return (
        <div className={styles.root}>
            {checking ? (
                <>
                    <p className={styles.title}>{t('Connecting your Xcity account')}</p>
                    <p className={styles.description}>{t('Fetching your TokenHub key from xcity<dot>ai')}</p>
                </>
            ) : (
                <>
                    <p className={styles.title}>{t('Sign in with Xcity')}</p>
                    <p className={styles.description}>
                        {t(
                            'Video generation uses your Xcity plan<dot> Sign in at xcity<dot>ai<comma> then return to the studio to connect your account'
                        )}
                    </p>
                    {error && <p className={styles.error}>({error})</p>}
                    <div className={styles.actions}>
                        <Button asChild className={styles.primary}>
                            <a href={xcityLoginHref()}>{t('Sign in at xcity<dot>ai')}</a>
                        </Button>
                        <Button type='button' variant='secondary' onClick={onRetry} className={styles.secondary}>
                            {t('Retry')}
                        </Button>
                        {onConfigure && (
                            <Button type='button' variant='ghost' onClick={onConfigure} className={styles.alternative}>
                                {t('Use an API key instead')}
                            </Button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
