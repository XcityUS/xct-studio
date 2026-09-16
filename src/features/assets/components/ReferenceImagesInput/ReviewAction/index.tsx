'use client';

import styles from './index.module.scss';
import { ReviewImageError, type ProviderAssetReviewInput } from '@/features/assets/hooks/use-provider-asset-review';
import type { InlineReviewOrigin } from '@/features/assets/reference/origin';
import type { VideoPortrait } from '@/features/generation/history/merge';
import { CheckCircle2, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type ReviewActionProps = {
    url: string;
    label: string;
    name?: string;
    origin: InlineReviewOrigin;
    asset?: VideoPortrait;
    autoSubmit?: boolean;
    disabled?: boolean;
    onReview: (input: ProviderAssetReviewInput) => Promise<string>;
    onApproved: (assetUrl: string) => void;
};

function ReviewStatus({ asset }: { asset: VideoPortrait }) {
    const t = useTranslations();
    return (
        <div className={styles.status} data-status={asset.status.toLowerCase()}>
            <span>
                {asset.status === 'Active'
                    ? t('Approved')
                    : asset.status === 'Failed'
                      ? t('Failed')
                      : t('Under review')}
            </span>
        </div>
    );
}

function useReviewSubmission(props: ReviewActionProps) {
    const t = useTranslations();
    const [isReviewing, setIsReviewing] = React.useState(false);
    const [error, setError] = React.useState('');
    const submit = async () => {
        setIsReviewing(true);
        setError('');
        try {
            const assetUrl = await props.onReview({
                url: props.url,
                origin: props.origin,
                name: props.name?.trim() || props.label
            });
            props.onApproved(assetUrl);
        } catch (reviewError) {
            setError(reviewError instanceof ReviewImageError ? reviewError.message : t('Asset review failed'));
        } finally {
            setIsReviewing(false);
        }
    };
    return { error, isReviewing, submit };
}

export function ReviewAction(props: ReviewActionProps) {
    const { asset, disabled } = props;
    const t = useTranslations();
    const submission = useReviewSubmission(props);
    const attempted = React.useRef(false);
    const status = asset?.status;
    React.useEffect(() => {
        if (!props.autoSubmit || disabled || status === 'Failed' || attempted.current) return;
        attempted.current = true;
        void submission.submit();
    }, [disabled, props.autoSubmit, status, submission]);
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
            {(submission.isReviewing || !props.autoSubmit || status === 'Failed' || submission.error) && (
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
            )}
            {asset && <ReviewStatus asset={asset} />}
            {(submission.error || asset?.status === 'Failed') && (
                <p className={styles.error}>{submission.error || t('Asset review failed')}</p>
            )}
        </div>
    );
}
