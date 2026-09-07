'use client';

import styles from './index.module.scss';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface ApiKeyGateProps {
    isBlocked: boolean;
    onConfigure: () => void;
    children: React.ReactNode;
    className?: string;
}

export function ApiKeyGate({ isBlocked, onConfigure, children, className }: ApiKeyGateProps) {
    const t = useTranslations();
    return (
        <div className={`${styles.root} ${className ?? ''}`}>
            <div aria-hidden={isBlocked || undefined} inert={isBlocked || undefined} className={styles.content}>
                {children}
            </div>
            {isBlocked && (
                <div
                    className={styles.overlay}
                    onClick={onConfigure}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onConfigure();
                        }
                    }}>
                    <div className={styles.message}>
                        <Lock size={48} aria-hidden='true' />
                        <div>
                            <h3>{t('Configure Xcity API Key')}</h3>
                            <p>{t('Click here to get started')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
