'use client';

import styles from './index.module.scss';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

type SignInGateProps = {
    checkingAuth: boolean;
    loginHref: string;
    allowManualApiKey: boolean;
    onConfigure: () => void;
};

export function SignInGate({ checkingAuth, loginHref, allowManualApiKey, onConfigure }: SignInGateProps) {
    const t = useTranslations();

    return (
        <section className={styles.root} aria-labelledby='sign-in-gate-title'>
            <div className={styles.hero}>
                <p className={styles.eyebrow}>XCITY STUDIO</p>
                <h1 id='sign-in-gate-title'>{t('Turn ideas into videos')}</h1>
                <p className={styles.description}>
                    {t('Create videos and manage your projects and assets in one workspace')}
                </p>

                {checkingAuth ? (
                    <div className={styles.checking} role='status'>
                        <LoaderCircle size={18} aria-hidden='true' />
                        <span>{t('Loading your workspace')}</span>
                    </div>
                ) : (
                    <div className={styles.actions}>
                        <a className={styles.primaryAction} href={loginHref}>
                            <span>{t('Sign in with Xcity')}</span>
                            <ArrowRight size={18} aria-hidden='true' />
                        </a>
                        {allowManualApiKey && (
                            <button className={styles.secondaryAction} type='button' onClick={onConfigure}>
                                {t('Use an API key instead')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
