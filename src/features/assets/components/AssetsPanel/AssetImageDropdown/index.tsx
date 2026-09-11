'use client';

import { AssetImageOption } from '../AssetImageOption';
import styles from './index.module.scss';
import { Dropdown } from '@/components/ui/Dropdown';
import type { UserAsset } from '@/lib/media-archive';

type AssetImageDropdownProps = {
    ariaLabel: string;
    assets: UserAsset[];
    disabled: boolean;
    placeholder: string;
    value: string;
    labelFor: (asset: UserAsset) => string;
    onValueChange: (value: string, asset?: UserAsset) => void;
};

export function AssetImageDropdown({
    ariaLabel,
    assets,
    disabled,
    placeholder,
    value,
    labelFor,
    onValueChange
}: AssetImageDropdownProps) {
    return (
        <Dropdown
            ariaLabel={ariaLabel}
            value={value}
            onValueChange={(nextValue) => onValueChange(nextValue, assets.find((asset) => asset.key === nextValue))}
            disabled={disabled || assets.length === 0}
            size='sm'
            triggerClassName={styles.trigger}
            contentClassName={styles.content}
            options={[
                { value: '', label: placeholder },
                ...assets.map((asset) => {
                    const label = labelFor(asset);
                    return {
                        value: asset.key,
                        label: <AssetImageOption asset={asset} label={label} />,
                        selectedLabel: label,
                        textValue: label
                    };
                })
            ]}
        />
    );
}
