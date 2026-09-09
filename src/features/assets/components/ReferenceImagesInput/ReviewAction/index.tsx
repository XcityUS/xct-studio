'use client';

import styles from './index.module.scss';
import type { ProviderAssetReviewInput } from '@/features/assets/hooks/use-provider-asset-review';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import type { InlineReviewOrigin } from '@/features/assets/reference/origin';
import type { VideoPortrait } from '@/features/generation/history/merge';
import { CheckCircle2, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type ReviewActionProps = {
    url: string;
    label: string;
    origin: InlineReviewOrigin;
    asset?: VideoPortrait;
    disabled?: boolean;
    onReview: (input: ProviderAssetReviewInput) => Promise<string>;
    onApproved: (assetUrl: string) => void;
};

function shortAssetId(value: string): string {
    return value.length > 12 ? `${value.slice(0, 5)}...${value.slice(-5)}` : value;
}

function ReviewStatus({ asset }: { asset: VideoPortrait }) {
    const t = useTranslations();
    return (
        <div className={styles.status} data-status={asset.status.toLowerCase()}>
            <span>
                {asset.status === 'Active' ? t('Approved') : asset.status === 'Failed' ? t('Failed') : t('Under review')}
            </span>
            <code>{shortAssetId(asset.assetId)}</code>
        </div>
    );
}

function useReviewSubmission(props: ReviewActionProps, name: string) {
    const t = useTranslations();
    const [isReviewing, setIsReviewing] = React.useState(false);
    const [error, setError] = React.useState('');
    const submit = async () => {
        setIsReviewing(true);
        setError('');
        try {
            const assetUrl =
                props.asset?.status === 'Active'
                    ? portraitReferenceUrl(props.asset.assetId)
                    : await props.onReview({ url: props.url, origin: props.origin, name: name.trim() || props.label });
            props.onApproved(assetUrl);
        } catch (reviewError) {
            setError(reviewError instanceof Error ? reviewError.message : t('Asset review failed'));
        } finally {
            setIsReviewing(false);
        }
    };
    return { error, isReviewing, submit };
}

export function ReviewAction(props: ReviewActionProps) {
    const { asset, disabled, origin } = props;
    const t = useTranslations();
    const [name, setName] = React.useState('');
    const submission = useReviewSubmission(props, name);
    const status = asset?.status;
    const actionLabel =
        status === 'Active'
            ? t('Use approved asset')
            : status === 'Failed'
              ? t('Retry review')
              : status === 'Processing'
                ? t('Check review status')
                : t('Submit material for review');
    const ActionIcon = status === 'Active' ? CheckCircle2 : status === 'Failed' ? RotateCcw : ShieldCheck;

    return (
        <div className={styles.root}>
            {origin !== 'no-person' && (
                <input
                    className={styles.input}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('Asset name')}
                    disabled={disabled || submission.isReviewing}
                />
            )}
            <button
                className={styles.button}
                type='button'
                onClick={() => void submission.submit()}
                disabled={disabled || submission.isReviewing}>
                {submission.isReviewing ? (
                    <Loader2 className={styles.spinner} aria-hidden='true' />
                ) : (
                    <ActionIcon aria-hidden='true' />
                )}
                {submission.isReviewing ? t('Review in progress') : actionLabel}
            </button>
            {asset && <ReviewStatus asset={asset} />}
            {(submission.error || asset?.failureReason) && (
                <p className={styles.error}>{submission.error || asset?.failureReason}</p>
            )}
        </div>
    );
}
