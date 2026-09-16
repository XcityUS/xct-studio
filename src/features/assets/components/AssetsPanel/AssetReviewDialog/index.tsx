'use client';

import styles from './index.module.scss';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Dropdown } from '@/components/ui/Dropdown';
import { ReviewImageError, type ProviderAssetReviewInput } from '@/features/assets/hooks/use-provider-asset-review';
import { normalizeProviderAssetName } from '@/features/assets/portrait/name';
import type { InlineReviewOrigin } from '@/features/assets/reference/origin';
import type { UserAsset } from '@/lib/media-archive';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type AssetReviewDialogProps = {
    asset: UserAsset;
    initialOrigin?: InlineReviewOrigin;
    onOpenChange: (open: boolean) => void;
    onSubmit: (input: ProviderAssetReviewInput) => Promise<void>;
};

const REVIEW_ORIGINS: InlineReviewOrigin[] = ['no-person', 'thirdparty-ai', 'public-figure', 'licensed-ip'];
function defaultAssetName(asset: UserAsset): string {
    const name =
        asset.name?.trim() ||
        asset.key
            .split('/')
            .pop()
            ?.replace(/\.[^.]+$/, '') ||
        'Reviewed material';
    return normalizeProviderAssetName(name);
}

export function AssetReviewDialog({ asset, initialOrigin, onOpenChange, onSubmit }: AssetReviewDialogProps) {
    const t = useTranslations();
    const [origin, setOrigin] = React.useState<InlineReviewOrigin | ''>(
        initialOrigin && REVIEW_ORIGINS.includes(initialOrigin) ? initialOrigin : ''
    );
    const [error, setError] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);

    const originLabel = (value: InlineReviewOrigin) => {
        if (value === 'thirdparty-ai') return t('External AI material');
        if (value === 'public-figure') return t('Authorized public figure');
        if (value === 'licensed-ip') return t('Authorized protected IP');
        return t('Reviewed material without a person or protected IP');
    };
    const originOptions = REVIEW_ORIGINS.map((value) => ({ value, label: originLabel(value) }));

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className={styles.content}>
                <DialogHeader>
                    <DialogTitle>{t('Submit for review')}</DialogTitle>
                    <DialogDescription>
                        {t('Choose the content type<dot> Studio will handle review and linking')}
                    </DialogDescription>
                </DialogHeader>
                <form
                    className={styles.form}
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (!origin) return;
                        setSubmitting(true);
                        setError(null);
                        try {
                            await onSubmit({
                                url: asset.url,
                                name: defaultAssetName(asset),
                                origin,
                                assetType: asset.kind === 'video' ? 'Video' : 'Image'
                            });
                            onOpenChange(false);
                        } catch (submitError) {
                            setError(
                                submitError instanceof ReviewImageError
                                    ? submitError.message
                                    : t('Review submission failed')
                            );
                        } finally {
                            setSubmitting(false);
                        }
                    }}>
                    <label className={styles.field}>
                        <span className={styles.label}>{t('Material source')}</span>
                        <Dropdown
                            value={origin}
                            options={originOptions}
                            onValueChange={(value) => setOrigin(value as InlineReviewOrigin)}
                            placeholder={t('Choose material source')}
                            triggerClassName={styles.select}
                            ariaLabel={t('Material source')}
                        />
                    </label>
                    {(origin === 'public-figure' || origin === 'licensed-ip') && (
                        <p className={styles.notice}>
                            {t(
                                'Public figures and protected IP require completed offline authorization and account allowlisting before submission'
                            )}
                        </p>
                    )}
                    <p className={styles.notice}>{t('Ordinary people must use face verification')}</p>
                    {error && <p className={styles.error}>{error}</p>}
                    <div className={styles.actions}>
                        <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                            {t('Cancel')}
                        </Button>
                        <Button type='submit' disabled={submitting || !origin}>
                            {submitting ? <Loader2 size={15} className={styles.spinner} /> : <ShieldCheck size={15} />}
                            {submitting ? t('Waiting for review') : t('Submit for review')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
