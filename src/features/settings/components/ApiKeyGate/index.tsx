'use client';

import styles from './index.module.scss';
import { useLoginHref } from '@/features/settings/hooks/use-login-href';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface ApiKeyGateProps {
    isBlocked: boolean;
    onConfigure?: () => void;
    children: React.ReactNode;
    className?: string;
}

export function ApiKeyGate({ isBlocked, onConfigure, children, className }: ApiKeyGateProps) {
    const t = useTranslations();
    const loginHref = useLoginHref();
    return (
        <div className={`${styles.root} ${className ?? ''}`}>
            <div aria-hidden={isBlocked || undefined} inert={isBlocked || undefined} className={styles.content}>
                {children}
            </div>
            {isBlocked && onConfigure && (
                <button className={styles.overlay} type='button' onClick={onConfigure}>
                    <div className={styles.message}>
                        <Lock size={48} aria-hidden='true' />
                        <div>
                            <h3>{t('Configure Xcity API Key')}</h3>
                            <p>{t('Click here to get started')}</p>
                        </div>
                    </div>
                </button>
            )}
            {isBlocked && !onConfigure && (
                <a
                    className={styles.overlay}
                    href={loginHref}>
                    <div className={styles.message}>
                        <Lock size={48} aria-hidden='true' />
                        <div>
                            <h3>{t('Sign in with Xcity')}</h3>
                            <p>{t('Sign in to load your projects')}</p>
                        </div>
                    </div>
                </a>
            )}
        </div>
    );
}
