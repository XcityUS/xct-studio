'use client';

import styles from './index.module.scss';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type DeleteCharacterGroupDialogProps = {
    error: string | null;
    groupName: string | null;
    isDeleting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export function DeleteCharacterGroupDialog({
    error,
    groupName,
    isDeleting,
    onCancel,
    onConfirm
}: DeleteCharacterGroupDialogProps) {
    const t = useTranslations();
    return (
        <Dialog open={groupName !== null} onOpenChange={(open) => !open && !isDeleting && onCancel()}>
            <DialogContent className={styles.dialog} hideCloseButton>
                <div className={styles.icon} aria-hidden='true'>
                    <AlertTriangle />
                </div>
                <div className={styles.copy}>
                    <DialogTitle className={styles.title}>{t('Delete character group')}</DialogTitle>
                    <DialogDescription className={styles.description}>
                        {t('This action cannot be undone')}
                    </DialogDescription>
                </div>
                <div className={styles.groupName}>{groupName}</div>
                <p className={styles.warning}>
                    {t('This empty group will be permanently deleted from the provider library')}
                </p>
                {error && (
                    <p className={styles.error} role='alert'>
                        {error}
                    </p>
                )}
                <div className={styles.actions}>
                    <button type='button' className={styles.cancel} disabled={isDeleting} onClick={onCancel} autoFocus>
                        {t('Cancel')}
                    </button>
                    <button type='button' className={styles.confirm} disabled={isDeleting} onClick={onConfirm}>
                        {isDeleting ? <Loader2 className={styles.spinner} /> : <Trash2 />}
                        {t('Permanently delete')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
