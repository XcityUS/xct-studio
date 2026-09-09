'use client';

import { ReferenceStatusBadge } from '../ReferenceStatusBadge';
import { assetReferenceLabel } from '../utils';
import styles from './index.module.scss';
import { isAssetReferenceUrl, type ReferenceDeclaration } from '@/features/assets/reference/origin';
import type { VideoPortrait } from '@/features/generation/history/merge';
import { ImageOff, ShieldCheck, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type SelectedReferenceProps = {
    url: string;
    index: number;
    portrait?: VideoPortrait;
    declaration?: ReferenceDeclaration;
    approvedAuthorizationIds: ReadonlySet<string>;
    disabled?: boolean;
    onRemove: () => void;
    onEdit: () => void;
};

function PreviewImage({ src, alt, fallback }: { src: string; alt: string; fallback: React.ReactNode }) {
    const [failed, setFailed] = React.useState(false);
    if (failed) return fallback;
    return (
        // eslint-disable-next-line @next/next/no-img-element -- provider or user-hosted reference thumbnail
        <img src={src} alt={alt} loading='lazy' className={styles.image} onError={() => setFailed(true)} />
    );
}

export function SelectedReference({
    url,
    index,
    portrait,
    declaration,
    approvedAuthorizationIds,
    disabled,
    onRemove,
    onEdit
}: SelectedReferenceProps) {
    const t = useTranslations();
    const isAsset = isAssetReferenceUrl(url);
    const previewUrl = portrait?.thumbUrl || (isAsset ? '' : url);
    const label = portrait?.name || t('Reference <lcur>number<rcur>', { number: index + 1 });
    const fallback = (
        <div className={styles.fallback}>
            {isAsset ? <ShieldCheck aria-hidden='true' /> : <ImageOff aria-hidden='true' />}
            <span>{isAsset ? assetReferenceLabel(url) : label}</span>
        </div>
    );

    return (
        <div className={styles.root}>
            <div className={styles.preview} title={portrait ? `${portrait.name} · ${portrait.assetId}` : url}>
                {previewUrl ? (
                    <PreviewImage key={previewUrl} src={previewUrl} alt={label} fallback={fallback} />
                ) : (
                    fallback
                )}
                {isAsset && (
                    <span className={styles.assetBadge} title={portrait?.assetId || assetReferenceLabel(url)}>
                        <ShieldCheck aria-hidden='true' />
                    </span>
                )}
                <span className={styles.indexBadge}>{index + 1}</span>
                <button
                    type='button'
                    onClick={onRemove}
                    disabled={disabled}
                    className={styles.remove}
                    aria-label={t('Remove reference image <lcur>number<rcur>', { number: index + 1 })}>
                    <X aria-hidden='true' />
                </button>
                <ReferenceStatusBadge
                    declaration={declaration}
                    approvedAuthorizationIds={approvedAuthorizationIds}
                    onEdit={disabled ? undefined : onEdit}
                />
            </div>
            <div className={styles.name}>{label}</div>
            {isAsset && <div className={styles.assetId}>{assetReferenceLabel(url)}</div>}
            {declaration && !disabled && (
                <button type='button' onClick={onEdit} className={styles.edit}>
                    {t('Change reference origin')}
                </button>
            )}
        </div>
    );
}
