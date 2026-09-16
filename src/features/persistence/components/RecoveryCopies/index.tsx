'use client';

import { listRecoveryCopies, readRecoveryCopy, recoveryCopiesSnapshot, subscribeRecoveryCopies } from '../../recovery';
import styles from './index.module.scss';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Download, History } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, useSyncExternalStore } from 'react';

export function RecoveryCopies({ owner }: { owner: string }) {
    const t = useTranslations();
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState(false);
    const snapshot = useSyncExternalStore(
        subscribeRecoveryCopies,
        () => recoveryCopiesSnapshot(owner),
        () => ''
    );
    const copies = useMemo(() => (snapshot ? listRecoveryCopies(owner) : []), [owner, snapshot]);
    if (!copies.length) return null;

    const download = (key: string, createdAt: number) => {
        const raw = readRecoveryCopy(owner, key);
        if (raw === null) {
            setError(true);
            return;
        }
        setError(false);
        const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `studio-recovery-${createdAt}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return (
        <>
            <button className={styles.launcher} type='button' onClick={() => setOpen(true)}>
                <History size={16} aria-hidden='true' />
                {t('Local recovery copies')} ({copies.length})
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className={styles.dialog}>
                    <DialogHeader>
                        <DialogTitle>{t('Local recovery copies')}</DialogTitle>
                        <DialogDescription>
                            {t('These copies stay in this browser<dot> Download one before clearing browser data')}
                        </DialogDescription>
                    </DialogHeader>
                    <ul className={styles.list}>
                        {copies.map((copy) => (
                            <li className={styles.item} key={copy.key}>
                                <div>
                                    <strong>
                                        {new Intl.DateTimeFormat(locale, {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        }).format(copy.createdAt)}
                                    </strong>
                                    <span>{t('<lcur>count<rcur> unsynced records', { count: copy.changeCount })}</span>
                                </div>
                                <button type='button' onClick={() => download(copy.key, copy.createdAt)}>
                                    <Download size={15} aria-hidden='true' />
                                    {t('Download backup')}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {error && (
                        <p className={styles.error} role='alert'>
                            {t('This recovery copy is no longer available')}
                        </p>
                    )}
                    <p className={styles.hint}>{t('Downloading does not overwrite the latest database version')}</p>
                </DialogContent>
            </Dialog>
        </>
    );
}
