'use client';

import styles from './index.module.scss';
import { Dropdown } from '@/components/ui/Dropdown';
import type { ProjectAsset, ProjectAssetKind } from '@/shared/contracts/production';
import { useTranslations } from 'next-intl';

const SNAPSHOT_BINDING_KINDS: ProjectAssetKind[] = [
    'character',
    'location',
    'prop',
    'image',
    'style',
];

type ProjectAssetWorkspaceProps = {
    assets: ProjectAsset[];
    onChangeKind: (assetId: string, kind: ProjectAssetKind) => void;
    onArchive: (assetId: string) => void;
};

export function ProjectAssetWorkspace({ assets, onChangeKind, onArchive }: ProjectAssetWorkspaceProps) {
    const t = useTranslations();
    const activeCount = assets.filter((asset) => asset.status === 'active').length;
    const characterCount = assets.filter((asset) => asset.kind === 'character').length;
    const kindOptions = [
        { value: 'character', label: t('Character') },
        { value: 'location', label: t('Location') },
        { value: 'prop', label: t('Prop') },
        { value: 'image', label: t('Image') },
        { value: 'video', label: t('Video') },
        { value: 'audio', label: t('Audio') },
        { value: 'document', label: t('Document') },
        { value: 'style', label: t('Visual style') },
        { value: 'other', label: t('Other') }
    ];
    const kindLabel = (kind: ProjectAssetKind) => {
        if (kind === 'character') return t('Character');
        if (kind === 'location') return t('Location');
        if (kind === 'prop') return t('Prop');
        if (kind === 'audio') return t('Audio');
        if (kind === 'video') return t('Video');
        if (kind === 'image') return t('Image');
        if (kind === 'document') return t('Document');
        if (kind === 'style') return t('Visual style');
        return t('Other');
    };
    const statusLabel = (status: ProjectAsset['status']) => {
        if (status === 'active') return t('Ready');
        if (status === 'archived') return t('Archived');
        if (status === 'failed' || status === 'revoked') return t('Failed');
        return t('Pending');
    };

    return (
        <section className={styles.panel} aria-label={t('Project Assets')}>
            <div className={styles.header}>
                <div>
                    <h3 className={styles.title}>{t('Project Assets')}</h3>
                    <p className={styles.description}>
                        {t(
                            'Bind reusable characters<comma> locations<comma> props<comma> documents<comma> and style references to the current project before generating shots'
                        )}
                    </p>
                </div>
                <div className={styles.summary}>
                    <span className={styles.chip}>{t('Total<colon> <lcur>count<rcur>', { count: assets.length })}</span>
                    <span className={styles.chip}>
                        {t('Provider<dash>ready<colon> <lcur>count<rcur>', { count: activeCount })}
                    </span>
                    <span className={styles.chip}>{t('Characters<colon> <lcur>count<rcur>', { count: characterCount })}</span>
                </div>
            </div>
            {assets.length === 0 ? (
                <div className={styles.empty}>
                    <strong>{t('No Project Assets yet')}</strong>
                    <span>
                        {t(
                            'To add assets<colon> upload files below<comma> register an Asset ID<comma> or click Project on an existing asset card'
                        )}
                    </span>
                    <span>
                        {t('Character<comma> location<comma> prop<comma> image<comma> and style assets will be snapshotted for each generated shot')}
                    </span>
                </div>
            ) : (
                <div className={styles.grid}>
                    {assets.map((asset) => (
                        <article key={asset.id} className={styles.asset}>
                            <div className={styles.info}>
                                <div className={styles.name}>{asset.name}</div>
                                <div className={styles.meta}>
                                    <span>{kindLabel(asset.kind)}</span>
                                    <span>{statusLabel(asset.status)}</span>
                                    {SNAPSHOT_BINDING_KINDS.includes(asset.kind) && <span>{t('Snapshot reference')}</span>}
                                    {asset.providerAssetId && <span>{asset.providerAssetId}</span>}
                                </div>
                            </div>
                            <div className={styles.actions}>
                                <Dropdown
                                    value={asset.kind}
                                    options={kindOptions}
                                    ariaLabel={t('Project Asset kind')}
                                    triggerClassName={styles.dropdown}
                                    onValueChange={(value) => onChangeKind(asset.id, value as ProjectAssetKind)}
                                    size='sm'
                                />
                                <button type='button' className={styles.remove} onClick={() => onArchive(asset.id)}>
                                    {t('Remove')}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
