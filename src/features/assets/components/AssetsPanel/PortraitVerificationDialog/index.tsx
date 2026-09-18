'use client';

import styles from './index.module.scss';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { ExternalLink, ShieldCheck, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

type PortraitVerificationDialogProps = {
    open: boolean;
    error: string | null;
    onClose: () => void;
    onRestartInNewWindow: () => void;
};

export function PortraitVerificationDialog({ open, error, onClose, onRestartInNewWindow }: PortraitVerificationDialogProps) {
    const t = useTranslations();

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
            <DialogContent className={styles.content} hideCloseButton>
                <DialogHeader className={styles.header}>
                    <div>
                        <DialogTitle>{t('Verify a real person')}</DialogTitle>
                        <DialogDescription className={styles.description}>
                            {t('Complete verification in the separate window<dot> Your verified person will appear automatically')}
                        </DialogDescription>
                    </div>
                    <button type='button' className={styles.close} onClick={onClose} aria-label={t('Close')}>
                        <X size={18} aria-hidden='true' />
                    </button>
                </DialogHeader>
                <div className={styles.status} role='status'>
                    <ShieldCheck size={32} aria-hidden='true' />
                    <span>{t('Waiting for verification to finish')}</span>
                </div>
                <div className={styles.fallback}>
                    <span>{t('Window closed or camera unavailable<q> Start a fresh verification session')}</span>
                    <button type='button' onClick={onRestartInNewWindow}>
                        {t('Restart verification in a new window')}
                        <ExternalLink size={14} aria-hidden='true' />
                    </button>
                </div>
                {error && <p className={styles.error} role='alert'>{error}</p>}
            </DialogContent>
        </Dialog>
    );
}
