import styles from './index.module.scss';
import { Clapperboard } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
    disabled: boolean;
    onOpen: () => void;
};

export function DramaLaunchPanel({ disabled, onOpen }: Props) {
    const t = useTranslations();

    return (
        <section className={styles.panel} aria-label={t('Short Drama workflow')}>
            <span className={styles.icon} aria-hidden='true'>
                <Clapperboard size={22} />
            </span>
            <div className={styles.copy}>
                <h3>{t('Create shots from a script')}</h3>
                <p>{t('Project settings control the model<comma> language<comma> format and output for every shot')}</p>
            </div>
            <button type='button' className={styles.button} disabled={disabled} onClick={onOpen}>
                {t('Open storyboard')}
            </button>
        </section>
    );
}
