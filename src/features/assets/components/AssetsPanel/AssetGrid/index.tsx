'use client';

import { AssetReviewDialog } from '../AssetReviewDialog';
import { CopyUrlButton } from '../CopyUrlButton';
import type { AssetListItem, AssetReviewState } from '../asset-list';
import { formatBytes, formatDate } from '../utils';
import { AssetPreview } from './AssetPreview';
import { AssetPreviewDialog } from './AssetPreviewDialog';
import { CopyAssetButton } from './CopyAssetButton';
import styles from './index.module.scss';
import type { ReferenceUseOptions } from '@/features/assets/components/AssetsPanel/types';
import type { ProviderAssetReviewInput } from '@/features/assets/hooks/use-provider-asset-review';
import { assetIdFromReferenceUrl, type InlineReviewOrigin } from '@/features/assets/reference/origin';
import { cn } from '@/shared/utils/classnames';
import {
    AlertCircle,
    Clock3,
    ImagePlus,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Trash2,
    UserPlus,
    Video
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

export type AssetGridProps = {
    items: AssetListItem[];
    onDelete: (item: AssetListItem) => Promise<void>;
    onReview: (input: ProviderAssetReviewInput) => Promise<string>;
    onSaveCharacter: (asset: AssetListItem['asset'], referenceUrl: string) => void;
    onUseImage: (sourceUrl: string, providerReferenceUrl?: string, options?: ReferenceUseOptions) => void;
    onUseVideo: (sourceUrl: string, providerReferenceUrl?: string) => void;
    checkingAssetId: string | null;
    onCheckReviewStatus: (portrait: NonNullable<AssetListItem['portrait']>) => Promise<void>;
};

function ReviewIcon({ state }: { state: AssetReviewState }) {
    if (state === 'active') return <ShieldCheck />;
    if (state === 'exempt') return <Sparkles />;
    if (state === 'processing') return <Clock3 />;
    return <AlertCircle />;
}

function ReviewStatusLabel({ state }: { state: AssetReviewState }) {
    const t = useTranslations();
    if (state === 'active') return t('Reviewed');
    if (state === 'exempt') return t('Seedream exempt');
    if (state === 'processing') return t('Under review');
    if (state === 'failed') return t('Failed');
    return t('Needs review');
}

function ReviewActionShortLabel({ state }: { state: AssetReviewState }) {
    const t = useTranslations();
    if (state === 'active' || state === 'exempt') return t('Use');
    if (state === 'processing') return t('Check');
    if (state === 'failed') return t('Retry');
    return t('Review');
}

const assetIdForItem = (item: AssetListItem): string | undefined =>
    item.providerAsset?.assetId ?? item.portrait?.assetId ?? assetIdFromReferenceUrl(item.referenceUrl ?? '');
export function AssetGrid({
    items,
    onDelete,
    onReview,
    onSaveCharacter,
    onUseImage,
    onUseVideo,
    checkingAssetId,
    onCheckReviewStatus
}: AssetGridProps) {
    const t = useTranslations();
    const locale = useLocale();
    const [reviewItem, setReviewItem] = React.useState<AssetListItem | null>(null);
    const [previewItem, setPreviewItem] = React.useState<AssetListItem | null>(null);

    const handleReference = (item: AssetListItem) => {
        if (item.reviewState === 'processing' && item.portrait) {
            void onCheckReviewStatus(item.portrait);
            return;
        }
        if (!item.referenceUrl) {
            setReviewItem(item);
            return;
        }
        if (item.asset.kind === 'video') onUseVideo(item.asset.url, item.referenceUrl);
        else onUseImage(item.asset.url, item.referenceUrl);
    };

    return (
        <>
            {reviewItem && (
                <AssetReviewDialog
                    key={reviewItem.asset.key}
                    asset={reviewItem.asset}
                    initialOrigin={reviewItem.portrait?.referenceOrigin as InlineReviewOrigin | undefined}
                    onOpenChange={(open) => !open && setReviewItem(null)}
                    onSubmit={async (input) => {
                        if (!onReview) return;
                        const referenceUrl = await onReview(input);
                        if (reviewItem.asset.kind === 'video') onUseVideo(reviewItem.asset.url, referenceUrl);
                        else onUseImage(reviewItem.asset.url, referenceUrl);
                    }}
                />
            )}
            <AssetPreviewDialog item={previewItem} onOpenChange={(open) => !open && setPreviewItem(null)} />
            <div className={styles.grid}>
                {items.map((item) => {
                    const { asset } = item;
                    const referenceUrl = item.referenceUrl;
                    const canUse = Boolean(referenceUrl);
                    const hasAssetId = Boolean(assetIdForItem(item));
                    const canSubmitForAssetId = Boolean(onReview) && asset.kind === 'image' && canUse && !hasAssetId;
                    const isReferenceMedia = asset.kind === 'image' || asset.kind === 'video';
                    const isChecking = item.portrait?.assetId === checkingAssetId;
                    const canDelete = item.source === 'cloud' || item.source === 'provider';
                    const deleteLabel =
                        item.source === 'provider' ? t('Remove from this workspace') : t('Delete from cloud storage');
                    return (
                        <article key={asset.key} className={styles.card} title={asset.key}>
                            <div className={styles.preview}>
                                {isReferenceMedia ? (
                                    <button
                                        type='button'
                                        className={styles.previewButton}
                                        aria-label={
                                            asset.kind === 'video' ? t('Open video preview') : t('Open image preview')
                                        }
                                        onClick={() => setPreviewItem(item)}>
                                        <AssetPreview key={asset.url || item.providerAsset?.assetId} item={item} />
                                    </button>
                                ) : (
                                    <AssetPreview key={asset.url || item.providerAsset?.assetId} item={item} />
                                )}
                                <span className={styles.kind}>
                                    {asset.kind === 'image'
                                        ? t('Image')
                                        : asset.kind === 'audio'
                                          ? t('Audio')
                                          : t('Video')}
                                </span>
                                {isReferenceMedia && (
                                    <span className={cn(styles.status, styles[item.reviewState])}>
                                        <ReviewIcon state={item.reviewState} />
                                        <ReviewStatusLabel state={item.reviewState} />
                                    </span>
                                )}
                                {canDelete && (
                                    <button
                                        type='button'
                                        title={deleteLabel}
                                        aria-label={deleteLabel}
                                        className={styles.delete}
                                        onClick={() => void onDelete(item)}>
                                        <Trash2 size={12} />
                                    </button>
                                )}
                                <div className={styles.meta}>
                                    <div className={styles.name}>
                                        {asset.name || asset.key.split('/').pop() || asset.key}
                                    </div>
                                    <div className={styles.details}>
                                        <span>{asset.uploaded ? formatDate(asset.uploaded, locale) : ''}</span>
                                        <span>
                                            {item.providerAsset ? t('My Xcity assets') : formatBytes(asset.bytes)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.actions}>
                                {asset.kind === 'image' && (
                                    <>
                                        {isReferenceMedia && (
                                            <button
                                                type='button'
                                                className={styles.action}
                                                disabled={isChecking}
                                                onClick={() => handleReference(item)}>
                                                {isChecking ? (
                                                    <Loader2 className={styles.spinner} />
                                                ) : canUse ? (
                                                    <ImagePlus />
                                                ) : item.reviewState === 'processing' ? (
                                                    <RefreshCw />
                                                ) : (
                                                    <ReviewIcon state={item.reviewState} />
                                                )}
                                                <span className={styles.actionLabel}>
                                                    <ReviewActionShortLabel state={item.reviewState} />
                                                </span>
                                            </button>
                                        )}
                                        <CopyAssetButton
                                            item={item}
                                            className={styles.action}
                                            labelClassName={styles.actionLabel}
                                        />
                                        {canSubmitForAssetId && (
                                            <button
                                                type='button'
                                                className={styles.action}
                                                onClick={() => setReviewItem(item)}>
                                                <ReviewIcon state='missing' />
                                                <span className={styles.actionLabel}>{t('Review')}</span>
                                            </button>
                                        )}
                                        {asset.url && (
                                            <CopyUrlButton
                                                url={asset.url}
                                                title={t('Copy URL')}
                                                label={t('Copy URL')}
                                                className={styles.action}
                                                labelClassName={styles.actionLabel}
                                            />
                                        )}
                                        {canUse && referenceUrl && (
                                            <button
                                                type='button'
                                                title={t('Save this image as a named character')}
                                                className={styles.action}
                                                onClick={() => onSaveCharacter(asset, referenceUrl)}>
                                                <UserPlus />
                                                <span className={styles.actionLabel}>{t('Role')}</span>
                                            </button>
                                        )}
                                    </>
                                )}
                                {asset.kind === 'video' && isReferenceMedia && (
                                    <button
                                        type='button'
                                        className={styles.action}
                                        disabled={isChecking}
                                        onClick={() => handleReference(item)}>
                                        {isChecking ? (
                                            <Loader2 className={styles.spinner} />
                                        ) : canUse ? (
                                            <Video />
                                        ) : item.reviewState === 'processing' ? (
                                            <RefreshCw />
                                        ) : (
                                            <ReviewIcon state={item.reviewState} />
                                        )}
                                        <span className={styles.actionLabel}>
                                            {canUse ? (
                                                t('Video ref')
                                            ) : (
                                                <ReviewActionShortLabel state={item.reviewState} />
                                            )}
                                        </span>
                                    </button>
                                )}
                                {asset.kind !== 'image' && (
                                    <CopyAssetButton
                                        item={item}
                                        className={styles.action}
                                        labelClassName={styles.actionLabel}
                                    />
                                )}
                                {asset.kind !== 'image' && asset.url && (
                                    <CopyUrlButton
                                        url={asset.url}
                                        title={t('Copy URL')}
                                        label={t('Copy URL')}
                                        className={styles.action}
                                        labelClassName={styles.actionLabel}
                                    />
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </>
    );
}
