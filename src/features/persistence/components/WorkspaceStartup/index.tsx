'use client';

import styles from './index.module.scss';
import { ActivityGraphic } from './ActivityGraphic';
import { StartupProgress, type StartupStage } from './StartupProgress';
import { useTranslations } from 'next-intl';

interface WorkspaceStartupProps {
    stage: StartupStage;
    stageLabel: string;
    progress: number;
    migrating: boolean;
    elapsed: number;
    processed: number;
    total: number;
}

type StartupDetailsProps = Pick<WorkspaceStartupProps, 'stage' | 'elapsed' | 'processed' | 'total'>;

function StartupDetails({ stage, elapsed, processed, total }: StartupDetailsProps) {
    const t = useTranslations();
    return (
        <>
            <div className={styles.details}>
                <span>{t('Elapsed <lcur>seconds<rcur> seconds', { seconds: elapsed })}</span>
                {stage === 'import' && total > 0 && (
                    <span>{t('Imported <lcur>completed<rcur> of <lcur>total<rcur> records', { completed: processed, total })}</span>
                )}
            </div>
            <div className={styles.footer}>
                <span className={styles.liveDot} aria-hidden='true' />
                <span>{t('Workspace sync is active')}</span>
            </div>
            {elapsed >= 30 && (
                <p className={styles.longWait}>
                    {t('Startup is taking longer<dot> Time depends on record count and network speed')}
                </p>
            )}
        </>
    );
}

export function WorkspaceStartup({
    stage,
    stageLabel,
    progress,
    migrating,
    elapsed,
    processed,
    total
}: WorkspaceStartupProps) {
    const t = useTranslations();

    return (
        <section className={styles.root} role='status' aria-live='polite'>
            <div className={styles.card}>
                <div className={styles.hero}>
                    <ActivityGraphic />
                    <div className={styles.intro}>
                        <span className={styles.eyebrow}>XCITY STUDIO</span>
                        <h1>{t('Preparing your creative workspace')}</h1>
                        <p>{t('Connecting your projects<comma> assets<comma> and production history')}</p>
                    </div>
                </div>

                <StartupProgress
                    stage={stage}
                    stageLabel={stageLabel}
                    progress={progress}
                    migrating={migrating}
                />

                <StartupDetails stage={stage} elapsed={elapsed} processed={processed} total={total} />
            </div>
        </section>
    );
}
