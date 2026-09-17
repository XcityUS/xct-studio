'use client';

import type { SingleImageMode } from '../types';
import styles from './index.module.scss';
import { useTranslations } from 'next-intl';

type Props = {
    imageCount: number;
    supportsReferenceMode: boolean;
    mode: SingleImageMode;
    onModeChange: (mode: SingleImageMode) => void;
    disabled: boolean;
};

export function SingleImageModeControl({ imageCount, supportsReferenceMode, mode, onModeChange, disabled }: Props) {
    const t = useTranslations();
    if (imageCount !== 1) return null;

    const isFirstFrame = !supportsReferenceMode || mode === 'first-frame';

    return (
        <div className={styles.root}>
            {supportsReferenceMode && (
                <div className={styles.modeGroup} role='group' aria-label={t('Single image use')}>
                    <button
                        type='button'
                        aria-pressed={mode === 'reference'}
                        className={styles.mode}
                        onClick={() => onModeChange('reference')}
                        disabled={disabled}>
                        {t('Reference')}
                    </button>
                    <button
                        type='button'
                        aria-pressed={mode === 'first-frame'}
                        className={styles.mode}
                        onClick={() => onModeChange('first-frame')}
                        disabled={disabled}>
                        {t('First frame')}
                    </button>
                </div>
            )}
            {isFirstFrame ? (
                <p className={styles.warning}>
                    {t(
                        'First<dash>frame mode follows the image ratio<dot> To generate landscape video<comma> prepare the image on a 16<colon>9 canvas first<dot> Prompt text cannot override this'
                    )}
                </p>
            ) : (
                <p className={styles.help}>
                    {t(
                        'Visual reference uses the selected output ratio<dot> The image guides appearance but is not an exact first frame'
                    )}
                </p>
            )}
        </div>
    );
}
