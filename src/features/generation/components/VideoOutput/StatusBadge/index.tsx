'use client';

import styles from './index.module.scss';
import type { VideoJob } from '@/shared/contracts/video';
import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function StatusBadge({ status, progress }: { status: VideoJob['status']; progress: number }) {
    const t = useTranslations();
    const labels = {
        queued: t('Queued'),
        in_progress: t('Processing <lcur>progress<rcur><pct>', { progress }),
        completed: t('Completed'),
        failed: t('Failed')
    };
    const icons = { queued: Clock, in_progress: Loader2, completed: CheckCircle, failed: AlertCircle };
    const Icon = icons[status];

    return (
        <div className={styles.root} data-status={status} role='status'>
            <Icon aria-hidden='true' className={status === 'in_progress' ? styles.spinner : undefined} />
            <span>{labels[status]}</span>
        </div>
    );
}
