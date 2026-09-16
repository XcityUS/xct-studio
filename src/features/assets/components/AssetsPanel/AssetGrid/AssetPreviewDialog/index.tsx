'use client';

import type { AssetListItem } from '../../asset-list';
import styles from './index.module.scss';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type AssetPreviewDialogProps = {
    item: AssetListItem | null;
    onOpenChange: (open: boolean) => void;
};

function assetFileName(item: AssetListItem): string {
    return item.asset.name?.trim() || item.asset.key.split('/').pop() || item.asset.key;
}

export function AssetPreviewDialog({ item, onOpenChange }: AssetPreviewDialogProps) {
    const t = useTranslations();
    const [failed, setFailed] = React.useState(false);
    const asset = item?.asset;
    const title = asset?.kind === 'video' ? t('Video preview') : t('Image preview');
    const fileName = item ? assetFileName(item) : '';

    return (
        <Dialog
            open={Boolean(item)}
            onOpenChange={(open) => {
                if (!open) setFailed(false);
                onOpenChange(open);
            }}>
            <DialogContent className={styles.dialog}>
                <DialogHeader className={styles.header}>
                    <DialogTitle className={styles.title}>{title}</DialogTitle>
                    <DialogDescription className={styles.fileName} title={fileName}>
                        {fileName}
                    </DialogDescription>
                </DialogHeader>
                <div className={styles.stage}>
                    {failed || !asset?.url ? (
                        <div className={styles.unavailable} role='status'>
                            <AlertCircle aria-hidden='true' />
                            <span>{t('ModelArk preview unavailable')}</span>
                        </div>
                    ) : asset.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element -- provider/cloud media URL
                        <img src={asset.url} alt={fileName} className={styles.media} onError={() => setFailed(true)} />
                    ) : (
                        <VideoPlayer
                            src={asset.url}
                            instanceKey={asset.key}
                            className={styles.videoPlayer}
                            title={fileName}
                            autoPlay
                            preload='auto'
                            onSourceError={() => setFailed(true)}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
