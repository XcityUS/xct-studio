'use client';

import { AssetImageDropdown } from '../AssetImageDropdown';
import { CopyUrlButton } from '../CopyUrlButton';
import styles from './index.module.scss';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { PortraitGroup, ProviderLibraryAsset } from '@/features/assets/portrait/api';
import type { UserAsset } from '@/lib/media-archive';
import { ArrowLeft, ImageIcon, ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Draft = { assetKey: string; name: string };

type CharacterGroupBrowserProps = {
    groups: PortraitGroup[];
    assets: ProviderLibraryAsset[];
    sourceAssets: UserAsset[];
    drafts: Record<string, Draft>;
    addingGroupId: string | null;
    deletingGroupId: string | null;
    assetInventoryReady: boolean;
    groupLabel: (group: PortraitGroup) => string;
    sourceLabel: (asset: UserAsset) => string;
    onAdd: (groupId: string) => Promise<void>;
    onDelete: (group: PortraitGroup) => void;
    onDraftChange: (groupId: string, patch: Partial<Draft>) => void;
};

export function CharacterGroupBrowser({
    groups,
    assets,
    sourceAssets,
    drafts,
    addingGroupId,
    deletingGroupId,
    assetInventoryReady,
    groupLabel,
    sourceLabel,
    onAdd,
    onDelete,
    onDraftChange
}: CharacterGroupBrowserProps) {
    const t = useTranslations();
    const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
    const selectedGroup = groups.find((group) => group.id === selectedGroupId);

    if (!selectedGroup) {
        return (
            <div className={styles.groupGrid} aria-label={t('All character groups')}>
                {groups.map((group) => {
                    const groupAssets = assets.filter((asset) => asset.groupId === group.id);
                    const cover = groupAssets.find((asset) => asset.previewUrl)?.previewUrl;
                    const label = groupLabel(group);
                    const isDeleting = deletingGroupId === group.id;
                    const deleteBlocked = !assetInventoryReady || groupAssets.length > 0;
                    const deleteReason = !assetInventoryReady
                        ? t('Asset inventory unavailable<semi> refresh before deleting this group')
                        : groupAssets.length > 0
                          ? t('Only empty character groups can be deleted')
                          : t('Delete empty character group');
                    return (
                        <article key={group.id} className={styles.groupCard}>
                            <button
                                type='button'
                                className={styles.groupOpen}
                                aria-label={t('Open character group <lcur>name<rcur>', { name: label })}
                                onClick={() => setSelectedGroupId(group.id)}>
                                <span className={styles.groupCover}>
                                    {cover ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- provider preview URL
                                        <img src={cover} alt='' loading='lazy' />
                                    ) : (
                                        <Sparkles aria-hidden='true' />
                                    )}
                                </span>
                                <span className={styles.groupSummary}>
                                    <strong>{label}</strong>
                                    <span>
                                        {t('Assets')} {groupAssets.length}
                                    </span>
                                </span>
                            </button>
                            <button
                                type='button'
                                className={styles.deleteButton}
                                aria-label={`${t('Delete character group')}: ${label}`}
                                title={deleteReason}
                                disabled={isDeleting || deleteBlocked}
                                onClick={() => onDelete(group)}>
                                {isDeleting ? <Loader2 className={styles.spinner} /> : <Trash2 />}
                            </button>
                        </article>
                    );
                })}
            </div>
        );
    }

    const selectedAssets = assets.filter((asset) => asset.groupId === selectedGroup.id);
    const draft = drafts[selectedGroup.id] ?? { assetKey: '', name: '' };
    const isAdding = addingGroupId === selectedGroup.id;
    return (
        <section className={styles.detail} aria-label={groupLabel(selectedGroup)}>
            <header className={styles.detailHeader}>
                <button type='button' className={styles.backButton} onClick={() => setSelectedGroupId(null)}>
                    <ArrowLeft aria-hidden='true' />
                    {t('Back to character groups')}
                </button>
                <div className={styles.detailTitle}>
                    <strong>{groupLabel(selectedGroup)}</strong>
                    <span>
                        {t('Assets')} {selectedAssets.length}
                    </span>
                </div>
            </header>

            {selectedAssets.length > 0 ? (
                <div className={styles.assetGrid}>
                    {selectedAssets.map((asset) => (
                        <article className={styles.assetCard} key={asset.assetId} title={asset.assetId}>
                            <div className={styles.assetPreview}>
                                {asset.previewUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- provider preview URL
                                    <img src={asset.previewUrl} alt={asset.name} loading='lazy' />
                                ) : (
                                    <ImageIcon aria-hidden='true' />
                                )}
                            </div>
                            <div className={styles.assetMeta}>
                                <strong>{asset.name || asset.assetId}</strong>
                                <code title={asset.assetId}>{asset.assetId}</code>
                                <span data-status={asset.status}>
                                    {asset.status === 'Active'
                                        ? t('Reviewed')
                                        : asset.status === 'Failed'
                                          ? t('Failed')
                                          : t('Under review')}
                                </span>
                            </div>
                            <CopyUrlButton
                                url={asset.assetId}
                                title={t('Copy asset ID')}
                                className={styles.copyButton}
                                labelClassName={styles.copyLabel}
                            />
                        </article>
                    ))}
                </div>
            ) : (
                <p className={styles.empty}>{t('No assets in this character group')}</p>
            )}

            <div className={styles.addRow}>
                <AssetImageDropdown
                    ariaLabel={t('Virtual character image asset')}
                    assets={sourceAssets}
                    value={draft.assetKey}
                    onValueChange={(value, asset) =>
                        onDraftChange(selectedGroup.id, {
                            assetKey: value,
                            name: draft.name || (asset ? sourceLabel(asset) : '')
                        })
                    }
                    disabled={isAdding}
                    placeholder={t('Choose image asset')}
                    labelFor={sourceLabel}
                />
                <Input
                    value={draft.name}
                    onChange={(event) => onDraftChange(selectedGroup.id, { name: event.target.value })}
                    placeholder={t('Name')}
                    disabled={isAdding}
                    className={styles.nameInput}
                />
                <Button
                    type='button'
                    size='sm'
                    onClick={() => void onAdd(selectedGroup.id)}
                    disabled={isAdding || !draft.assetKey}
                    className={styles.addButton}>
                    {isAdding ? <Loader2 className={styles.spinner} /> : <ImagePlus />}
                    {t('Add character image')}
                </Button>
            </div>
            {sourceAssets.length === 0 && (
                <p className={styles.hint}>{t('Upload or save an image asset first')}</p>
            )}
        </section>
    );
}
