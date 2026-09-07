'use client';

import styles from './index.module.scss';
import type { VideoJob } from '@/shared/contracts/video';
import { useTranslations } from 'next-intl';

export function Metadata({ job }: { job: Pick<VideoJob, 'model' | 'size' | 'seconds'> }) {
    const t = useTranslations();
    return (
        <dl className={styles.root}>
            <div>
                <dt>{t('Model<colon>')}</dt>
                <dd>{job.model}</dd>
            </div>
            <div>
                <dt>{t('Resolution<colon>')}</dt>
                <dd>{job.size}</dd>
            </div>
            <div>
                <dt>{t('Duration<colon>')}</dt>
                <dd>{t('<lcur>seconds<rcur>s', { seconds: job.seconds })}</dd>
            </div>
        </dl>
    );
}
