'use client';

import { reviewedAssetChoices } from './choices';
import styles from './index.module.scss';
import { Dropdown } from '@/components/ui/Dropdown';
import type { ProjectAsset } from '@/shared/contracts/production';
import { Loader2, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
    assetId?: string;
    ariaLabel: string;
    assets: ProjectAsset[];
    onCommit: (assetId?: string) => void;
    onRegenerate?: () => void | Promise<void>;
    isRegenerating?: boolean;
};

export function AssetBindingPicker({
    assetId,
    ariaLabel,
    assets,
    onCommit,
    onRegenerate,
    isRegenerating = false
}: Props) {
    const t = useTranslations();
    const choices = reviewedAssetChoices(assets);
    const unavailable = Boolean(
        assetId &&
            !choices.some((asset) => asset.value === assetId) &&
            assets.some((asset) => asset.providerAssetId?.trim() === assetId && asset.status !== 'active')
    );
    const options = [
        { value: '', label: t('Not bound') },
        ...choices.map((asset) => ({ value: asset.value, label: asset.name || t('Image') }))
    ];
    if (assetId && !choices.some((asset) => asset.value === assetId))
        options.push({
            value: assetId,
            label: unavailable ? t('Asset unavailable<semi> choose another') : t('Current linked asset')
        });

    return (
        <div className={styles.root} onClick={(event) => event.stopPropagation()}>
            <Dropdown
                value={assetId ?? ''}
                ariaLabel={ariaLabel}
                options={options}
                onValueChange={(value) => onCommit(value || undefined)}
                disabled={isRegenerating}
                triggerClassName={styles.select}
            />
            {assetId && onRegenerate && (
                <button type='button' disabled={isRegenerating} onClick={() => void onRegenerate()}>
                    {isRegenerating ? <Loader2 className={styles.spinner} size={13} /> : <Wand2 size={13} />}
                    {t('Regenerate')}
                </button>
            )}
        </div>
    );
}
