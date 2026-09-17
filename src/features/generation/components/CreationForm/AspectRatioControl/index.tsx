'use client';

import styles from './index.module.scss';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { Label } from '@/components/ui/Label';
import type { VideoRatio } from '@/shared/config/seedance';
import { useTranslations } from 'next-intl';

type Props = {
    ratio: VideoRatio;
    onRatioChange: (ratio: VideoRatio) => void;
    options: DropdownOption[];
    followsImageRatio: boolean;
    disabled: boolean;
};

export function AspectRatioControl({ ratio, onRatioChange, options, followsImageRatio, disabled }: Props) {
    const t = useTranslations();

    return (
        <div className={styles.root}>
            <Label htmlFor='ratio-select' className={styles.label}>
                {t('Aspect Ratio')}
            </Label>
            <Dropdown
                id='ratio-select'
                value={ratio}
                onValueChange={(value) => onRatioChange(value as VideoRatio)}
                disabled={disabled || followsImageRatio}
                options={options}
            />
        </div>
    );
}
