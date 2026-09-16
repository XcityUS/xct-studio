'use client';

import styles from './index.module.scss';
import { assetBindingStatus } from './choices';
import { MAX_REVIEW_CHECKS } from '../review-poll-batch';
import type { ProjectAsset } from '@/shared/contracts/production';
import { Loader2, RefreshCw, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Props = {
    assetId?: string;
    ariaLabel: string;
    assets: ProjectAsset[];
    onCommit: (assetId?: string) => void;
    onRegenerate?: () => void | Promise<void>;
    onRefreshAssetStatus?: (assetId: string) => Promise<ProjectAsset['status']>;
    pollAttempt?: number;
    generationLabel?: string;
    generationError?: string | null;
    disabled?: boolean;
    isRegenerating?: boolean;
};

export function normalizeManualAssetId(value: string) {
    return value.trim().replace(/^asset:\/\//i, '').trim();
}

export function AssetBindingPicker({ assetId, ariaLabel, assets, onCommit, onRegenerate, onRefreshAssetStatus, pollAttempt, generationLabel, generationError, disabled = false, isRegenerating = false }: Props) {
    const t = useTranslations();
    const [value, setValue] = React.useState(assetId ?? '');
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [refreshError, setRefreshError] = React.useState<string | null>(null);
    const [checkedStatus, setCheckedStatus] = React.useState<ProjectAsset['status'] | null>(null);
    const normalized = normalizeManualAssetId(value);
    const status = assetBindingStatus(normalized, assets);
    const unavailable = status !== 'unbound' && status !== 'active' && status !== 'unknown';
    const statusMessage = status === 'reviewing' ?
        (checkedStatus === 'reviewing' ? t('Just checked<semi> still under review') : t('Asset review in progress<semi> not ready yet')) :
        status === 'uploaded' ? t('Asset has not been reviewed yet') :
        status === 'failed' ? t('Asset review failed<semi> choose another') :
        status === 'revoked' ? t('Asset authorization revoked<semi> choose another') :
        status === 'archived' ? t('Asset archived<semi> choose another') : null;
    const canConfirm = Boolean(normalized && normalized !== assetId && !unavailable && !disabled);
    const confirm = () => { if (canConfirm) onCommit(normalized); };
    const canRefresh = Boolean(assetId && normalized === assetId && onRefreshAssetStatus &&
        (status === 'reviewing' || status === 'failed' || status === 'uploaded'));
    const autoChecking = status === 'reviewing' && pollAttempt !== undefined && pollAttempt < MAX_REVIEW_CHECKS;
    const refresh = async () => {
        if (!assetId || !onRefreshAssetStatus || isRefreshing) return;
        setIsRefreshing(true);
        setRefreshError(null);
        try {
            setCheckedStatus(await onRefreshAssetStatus(assetId));
        } catch {
            setRefreshError(t('Could not refresh asset status<dot> Please try again'));
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className={styles.root} data-regenerate={Boolean(onRegenerate)} data-status={status} role='group' aria-label={ariaLabel} onClick={(event) => event.stopPropagation()}>
            <input aria-label={ariaLabel} aria-invalid={unavailable} disabled={disabled} value={value}
                placeholder={t('Paste asset ID from My assets')} onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    event.stopPropagation();
                    confirm();
                }} />
            <button type='button' disabled={!canConfirm} onClick={confirm}>{t('Confirm')}</button>
            {onRegenerate && <button type='button' className={styles.regenerateButton}
                aria-label={generationLabel ?? t('Generate image')} title={generationLabel ?? t('Generate image')}
                disabled={disabled} onClick={() => void onRegenerate()}>
                {isRegenerating ? <Loader2 className={styles.spinner} size={14} /> : <Wand2 size={14} />}
                <span>{generationLabel ?? t('Generate image')}</span>
            </button>}
            {statusMessage && <div className={styles.statusRow} role='status'>
                <span>{statusMessage}</span>
                {autoChecking && <span className={styles.autoStatus}>
                    <Loader2 aria-hidden='true' className={styles.spinner} size={13} />
                    {t('Checking automatically <lpar><lcur>count<rcur><slash>20<rpar>', { count: pollAttempt })}
                </span>}
                {status === 'reviewing' && pollAttempt === MAX_REVIEW_CHECKS && <span>{t('Automatic checks paused after 20 attempts')}</span>}
                {canRefresh && !autoChecking && <button type='button' className={styles.refreshButton} disabled={disabled || isRefreshing} onClick={() => void refresh()}>
                    <RefreshCw aria-hidden='true' className={isRefreshing ? styles.spinner : undefined} size={13} />
                    {isRefreshing ? t('Checking status') : t('Refresh status')}
                </button>}
            </div>}
            {refreshError && <span className={styles.error} role='alert'>{refreshError}</span>}
            {generationError && <span className={styles.error} role='alert'>{generationError}</span>}
        </div>
    );
}
