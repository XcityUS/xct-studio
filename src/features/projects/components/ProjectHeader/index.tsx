'use client';

import styles from './index.module.scss';
import { Dropdown } from '@/components/ui/Dropdown';
import { useVideoMode } from '@/features/projects/hooks/use-video-mode';
import { useTranslations } from 'next-intl';

export function ProjectHeader() {
    const t = useTranslations();
    const [mode, setMode] = useVideoMode();

    return (
        <section className={styles.panel} aria-label={t('Video mode')}>
            <Dropdown
                value={mode}
                onValueChange={(value) => setMode(value === 'drama' ? 'drama' : 'normal')}
                ariaLabel={t('Video mode')}
                size='sm'
                triggerClassName={styles.trigger}
                options={[
                    { value: 'normal', label: t('Normal') },
                    { value: 'drama', label: t('Short Drama') }
                ]}
            />
        </section>
    );
}
