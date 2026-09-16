'use client';

import styles from './index.module.scss';
import { useTranslations } from 'next-intl';

const STARTUP_STAGES = ['database', 'validation', 'import', 'legacy', 'media'] as const;
export type StartupStage = (typeof STARTUP_STAGES)[number] | 'ready';

interface StartupProgressProps {
    stage: StartupStage;
    stageLabel: string;
    progress: number;
    migrating: boolean;
}

export function StartupProgress({ stage, stageLabel, progress, migrating }: StartupProgressProps) {
    const t = useTranslations();
    const stageIndex = Math.max(0, STARTUP_STAGES.indexOf(stage === 'ready' ? 'media' : stage));
    const displayProgress = Math.max(0, Math.min(100, Math.floor(progress)));

    return (
        <div className={styles.root}>
            <div className={styles.meta}>
                <span>{stageLabel}</span>
                <strong>{migrating ? `${displayProgress}%` : t('Preparing')}</strong>
            </div>
            <progress
                className={`${styles.progress} ${migrating ? '' : styles.scanning}`}
                max={100}
                value={migrating ? displayProgress : undefined}
                aria-label={t('Startup progress')}
            />
            <div className={styles.stageRail} aria-hidden='true'>
                {STARTUP_STAGES.map((item, index) => (
                    <span
                        key={item}
                        data-complete={index < stageIndex || undefined}
                        data-current={index === stageIndex || undefined}
                    />
                ))}
            </div>
        </div>
    );
}
