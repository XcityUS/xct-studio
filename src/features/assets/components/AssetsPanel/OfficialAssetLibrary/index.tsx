import { CopyUrlButton } from '../CopyUrlButton';
import styles from './index.module.scss';
import type { ReferenceUseOptions } from '@/features/assets/components/AssetsPanel/types';
import type { ReferenceDeclaration } from '@/features/assets/reference/origin';
import { Check, ImagePlus, Library, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type OfficialAssetLibraryProps = {
    declarations: Record<string, ReferenceDeclaration>;
    referenceImageUrls: string[];
    onUseImage: (sourceUrl: string, providerReferenceUrl?: string, options?: ReferenceUseOptions) => void;
    onUpdateNote: (key: string, note: string) => void;
};

type OfficialAsset = ReferenceDeclaration & {
    key: string;
};

type SavedOfficialAsset = OfficialAsset & {
    assetId: string;
};

type UseOfficialAssetReference = (
    sourceUrl: string,
    providerReferenceUrl?: string,
    options?: ReferenceUseOptions
) => void;

function isSavedOfficialAsset(asset: OfficialAsset): asset is SavedOfficialAsset {
    return asset.origin === 'official-asset' && Boolean(asset.assetId);
}

function NoteEditor({
    draftNote,
    onDraftNoteChange,
    onCancel,
    onSave
}: {
    draftNote: string;
    onDraftNoteChange: (note: string) => void;
    onCancel: () => void;
    onSave: () => void;
}) {
    const t = useTranslations();
    return (
        <div className={styles.noteEditor}>
            <input
                value={draftNote}
                onChange={(event) => onDraftNoteChange(event.target.value)}
                placeholder={t('Describe this official asset')}
                autoFocus
            />
            <div className={styles.noteActions}>
                <button type='button' onClick={onSave}>
                    <Check aria-hidden='true' />
                    {t('Save description')}
                </button>
                <button type='button' onClick={onCancel}>
                    <X aria-hidden='true' />
                    {t('Cancel')}
                </button>
            </div>
        </div>
    );
}

function OfficialAssetActions({
    assetUrl,
    isAttached,
    onEdit,
    onUseImage
}: {
    assetUrl: string;
    isAttached: boolean;
    onEdit: () => void;
    onUseImage: UseOfficialAssetReference;
}) {
    const t = useTranslations();
    return (
        <div className={styles.cardActions}>
            <button type='button' className={styles.editButton} onClick={onEdit}>
                <Pencil aria-hidden='true' />
                {t('Edit description')}
            </button>
            <CopyUrlButton url={assetUrl} className={styles.copyButton} />
            <button
                type='button'
                className={styles.referenceButton}
                disabled={isAttached}
                onClick={() => onUseImage(assetUrl, assetUrl, { stayOnAssets: true })}>
                <ImagePlus aria-hidden='true' />
                {isAttached ? t('Already referenced') : t('Add reference')}
            </button>
        </div>
    );
}

function OfficialAssetCard({
    asset,
    referenceImageUrls,
    onUseImage,
    onUpdateNote
}: {
    asset: SavedOfficialAsset;
    referenceImageUrls: string[];
    onUseImage: UseOfficialAssetReference;
    onUpdateNote: (key: string, note: string) => void;
}) {
    const t = useTranslations();
    const [isEditing, setIsEditing] = React.useState(false);
    const [draftNote, setDraftNote] = React.useState('');
    const assetUrl = `asset://${asset.assetId}`;

    return (
        <article className={styles.assetCard}>
            <div>
                <strong>{asset.assetId}</strong>
                <span>{t('Seedance official reference asset')}</span>
                {isEditing ? (
                    <NoteEditor
                        draftNote={draftNote}
                        onDraftNoteChange={setDraftNote}
                        onCancel={() => setIsEditing(false)}
                        onSave={() => {
                            onUpdateNote(asset.key, draftNote);
                            setIsEditing(false);
                        }}
                    />
                ) : (
                    <p>{asset.note || t('No description yet')}</p>
                )}
            </div>
            <OfficialAssetActions
                assetUrl={assetUrl}
                isAttached={referenceImageUrls.includes(assetUrl)}
                onEdit={() => {
                    setDraftNote(asset.note ?? '');
                    setIsEditing(true);
                }}
                onUseImage={onUseImage}
            />
        </article>
    );
}

function SavedOfficialAssets({
    assets,
    referenceImageUrls,
    onUseImage,
    onUpdateNote
}: {
    assets: SavedOfficialAsset[];
    referenceImageUrls: string[];
    onUseImage: UseOfficialAssetReference;
    onUpdateNote: (key: string, note: string) => void;
}) {
    const t = useTranslations();
    if (assets.length === 0) return <p className={styles.empty}>{t('No saved official assets yet')}</p>;

    return (
        <div className={styles.savedAssets}>
            <h5>{t('Saved official assets')}</h5>
            <div className={styles.assetList}>
                {assets.map((asset) => (
                    <OfficialAssetCard
                        key={asset.key}
                        asset={asset}
                        referenceImageUrls={referenceImageUrls}
                        onUseImage={onUseImage}
                        onUpdateNote={onUpdateNote}
                    />
                ))}
            </div>
        </div>
    );
}

export function OfficialAssetLibrary({
    declarations,
    referenceImageUrls,
    onUseImage,
    onUpdateNote
}: OfficialAssetLibraryProps) {
    const t = useTranslations();
    const officialAssets = Object.entries(declarations)
        .map(([key, declaration]) => ({ key, ...declaration }))
        .filter(isSavedOfficialAsset)
        .sort((left, right) => right.declaredAt - left.declaredAt);

    return (
        <div className={styles.root}>
            <Library aria-hidden='true' />
            <div className={styles.content}>
                <h4>{t('Seedance official asset library')}</h4>
                <p>{t('Choose an approved official reference asset<comma> then paste its Asset ID above')}</p>
                <p className={styles.notice}>
                    {t('Official reference assets are limited to the usage permitted for your workspace')}
                </p>
                <SavedOfficialAssets
                    assets={officialAssets}
                    referenceImageUrls={referenceImageUrls}
                    onUseImage={onUseImage}
                    onUpdateNote={onUpdateNote}
                />
            </div>
        </div>
    );
}
