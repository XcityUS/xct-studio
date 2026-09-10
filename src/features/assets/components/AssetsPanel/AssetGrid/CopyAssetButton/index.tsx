'use client';

import { CopyUrlButton } from '../../CopyUrlButton';
import type { AssetListItem } from '../../asset-list';
import { assetIdFromReferenceUrl } from '@/features/assets/reference/origin';
import { useTranslations } from 'next-intl';

type CopyAssetButtonProps = {
    className?: string;
    item: AssetListItem;
    labelClassName?: string;
};

export function CopyAssetButton({ className, item, labelClassName }: CopyAssetButtonProps) {
    const t = useTranslations();
    const assetId =
        item.providerAsset?.assetId ??
        item.portrait?.assetId ??
        assetIdFromReferenceUrl(item.referenceUrl ?? '');
    if (!assetId) return null;

    return (
        <CopyUrlButton
            url={assetId}
            title={t('Copy asset ID')}
            label={t('Copy asset')}
            className={className}
            labelClassName={labelClassName}
        />
    );
}
