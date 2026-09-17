'use client';

import { AssetImageDropdown } from '../AssetImageDropdown';
import { PortraitAssetStatus } from '../PortraitAssetStatus';
import styles from './index.module.scss';
import { Dropdown } from '@/components/ui/Dropdown';
import type { PortraitGroup } from '@/features/assets/portrait/api';
import type { VerifiedPersonProfile } from '@/features/assets/portrait/people';
import type { VideoPortrait } from '@/features/generation/history/merge';
import type { UserAsset } from '@/lib/media-archive';
import { Check, ChevronDown, Copy, ImagePlus, Loader2, Trash2, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Props = {
    group: PortraitGroup;
    profile: VerifiedPersonProfile;
    photos: VideoPortrait[];
    sourceAssets: UserAsset[];
    characterGroups: PortraitGroup[];
    draft: { assetKey: string; name: string };
    busy: boolean;
    deleting: boolean;
    newlyVerified: boolean;
    canUpload: boolean;
    onProfileChange: (patch: Partial<VerifiedPersonProfile>) => void;
    onCoverUpload: (file: File) => Promise<void>;
    onDraftChange: (patch: Partial<{ assetKey: string; name: string }>) => void;
    onAddPhoto: () => void;
    onUploadPhoto: (file: File) => Promise<void>;
    onDelete: () => void;
    onSaveToGroup: (photo: VideoPortrait, groupId: string | null, newGroupName: string) => Promise<void>;
    onOpenVideo: () => void;
};

export function VerifiedPersonCard(props: Props) {
    const t = useTranslations();
    const coverInput = React.useRef<HTMLInputElement>(null);
    const photoInput = React.useRef<HTMLInputElement>(null);
    const [groupChoice, setGroupChoice] = React.useState('');
    const [newGroupName, setNewGroupName] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [saveError, setSaveError] = React.useState('');
    const [selectedPhotoId, setSelectedPhotoId] = React.useState<string | null>(null);
    const [addedPhotoId, setAddedPhotoId] = React.useState<string | null>(null);
    const [coverBusy, setCoverBusy] = React.useState(false);
    const [coverError, setCoverError] = React.useState('');
    const [uploadError, setUploadError] = React.useState('');
    const [copyState, setCopyState] = React.useState<{ assetId: string; failed: boolean } | null>(null);
    const cover = props.profile.coverUrl || props.photos.find((photo) => photo.thumbUrl)?.thumbUrl;
    const selectedPhoto = props.photos.find((photo) => photo.assetId === selectedPhotoId);
    const onCoverSelected = async (file?: File) => {
        if (!file) return;
        setCoverBusy(true);
        setCoverError('');
        try {
            await props.onCoverUpload(file);
        } catch {
            setCoverError(t('Could not upload cover image'));
        } finally {
            setCoverBusy(false);
        }
    };
    const copyAsset = async (assetId: string) => {
        try {
            await navigator.clipboard.writeText(`asset://${assetId}`);
            setCopyState({ assetId, failed: false });
        } catch {
            setCopyState({ assetId, failed: true });
        }
    };

    return (
        <section className={styles.card} aria-label={props.profile.name || t('Unnamed verified person')}>
            <header className={styles.header}>
                <div className={styles.cover}>
                    {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- private user-uploaded cover URL
                        <img src={cover} alt={props.profile.name || t('Verified person')} />
                    ) : (
                        <UserRound aria-hidden='true' />
                    )}
                </div>
                <div className={styles.identity}>
                    <label htmlFor={`person-${props.group.id}`}>{t('Verified person name')}</label>
                    <input
                        id={`person-${props.group.id}`}
                        autoFocus={props.newlyVerified && !props.profile.name}
                        value={props.profile.name}
                        maxLength={80}
                        placeholder={t('Enter this person<apos>s name')}
                        onChange={(event) => props.onProfileChange({ name: event.target.value })}
                    />
                    <span>
                        {t('Verified photos')}: {props.photos.length}
                    </span>
                </div>
                <div className={styles.headerActions}>
                    <input
                        ref={coverInput}
                        type='file'
                        accept='image/png,image/jpeg,image/webp'
                        hidden
                        onChange={(event) => {
                            void onCoverSelected(event.target.files?.[0]);
                            event.target.value = '';
                        }}
                    />
                    <button
                        type='button'
                        disabled={coverBusy || !props.canUpload}
                        onClick={() => coverInput.current?.click()}>
                        {coverBusy ? <Loader2 aria-hidden='true' /> : <ImagePlus aria-hidden='true' />}
                        {t('Set cover')}
                    </button>
                    <button
                        type='button'
                        className={styles.delete}
                        disabled={props.deleting || props.busy}
                        onClick={props.onDelete}>
                        {props.deleting ? <Loader2 aria-hidden='true' /> : <Trash2 aria-hidden='true' />}
                        {t('Delete verified person')}
                    </button>
                </div>
            </header>
            {coverError && <p className={styles.error}>{coverError}</p>}
            <div className={styles.library}>
                <div className={styles.sectionHeading}>
                    <strong>{t('Verified photos')}</strong>
                    <span>{props.photos.length}</span>
                </div>
                {props.photos.length ? (
                    <div className={styles.photos}>
                        {props.photos.map((photo) => {
                            const savedGroup = props.characterGroups.find(
                                (group) => group.id === props.profile.photoGroups?.[photo.assetId]
                            );
                            return (
                                <div key={photo.assetId} className={styles.photo}>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- provider-reviewed portrait URL */}
                                    <img src={photo.thumbUrl} alt={photo.name} />
                                    <div className={styles.photoInfo}>
                                        <strong title={photo.name}>{photo.name}</strong>
                                        <PortraitAssetStatus portrait={photo} />
                                    </div>
                                    {photo.status === 'Active' && (
                                        <div className={styles.photoActions}>
                                            <button
                                                type='button'
                                                className={styles.iconButton}
                                                title={t('Copy Asset ID')}
                                                aria-label={
                                                    copyState?.assetId === photo.assetId
                                                        ? copyState.failed
                                                            ? t('Copy failed')
                                                            : t('Copied')
                                                        : t('Copy Asset ID')
                                                }
                                                onClick={() => void copyAsset(photo.assetId)}>
                                                {copyState?.assetId === photo.assetId && !copyState.failed ? (
                                                    <Check aria-hidden='true' />
                                                ) : (
                                                    <Copy aria-hidden='true' />
                                                )}
                                            </button>
                                            <button
                                                type='button'
                                                className={styles.projectButton}
                                                onClick={() => {
                                                    setSelectedPhotoId(
                                                        selectedPhotoId === photo.assetId ? null : photo.assetId
                                                    );
                                                    setGroupChoice(savedGroup?.id || '');
                                                    setNewGroupName('');
                                                    setSaveError('');
                                                    setAddedPhotoId(null);
                                                }}>
                                                {savedGroup && <Check aria-hidden='true' />}
                                                {savedGroup ? t('In character group') : t('Save to character group')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className={styles.empty}>{t('Add a photo to this verified person to use it in a project')}</p>
                )}
                {selectedPhoto && (
                    <div className={styles.binding}>
                        <strong>{t('Save to character group')}</strong>
                        <p>{t('Choose an existing character group or create a new one')}</p>
                        <div className={styles.bindingControls}>
                            <label htmlFor={`group-${props.group.id}`}>{t('Character group')}</label>
                            <Dropdown
                                id={`group-${props.group.id}`}
                                value={groupChoice}
                                disabled={saving}
                                onValueChange={setGroupChoice}
                                ariaLabel={t('Character group')}
                                placeholder={t('Choose character group')}
                                triggerClassName={styles.groupSelect}
                                options={[
                                    { value: '', label: t('Choose character group') },
                                    ...props.characterGroups.map((group) => ({
                                        value: group.id,
                                        label: group.displayName || group.name
                                    })),
                                    { value: 'new', label: t('Create new character group') }
                                ]}
                            />
                            {groupChoice === 'new' && (
                                <input
                                    value={newGroupName}
                                    maxLength={80}
                                    placeholder={t('New character group name')}
                                    aria-label={t('New character group name')}
                                    onChange={(event) => setNewGroupName(event.target.value)}
                                />
                            )}
                            <button
                                type='button'
                                className={styles.primaryButton}
                                disabled={saving || !groupChoice || (groupChoice === 'new' && !newGroupName.trim())}
                                onClick={async () => {
                                    setSaving(true);
                                    setSaveError('');
                                    try {
                                        await props.onSaveToGroup(
                                            selectedPhoto,
                                            groupChoice === 'new' ? null : groupChoice,
                                            newGroupName.trim()
                                        );
                                        setAddedPhotoId(selectedPhoto.assetId);
                                    } catch {
                                        setSaveError(t('Could not save photo to character group'));
                                    } finally {
                                        setSaving(false);
                                    }
                                }}>
                                {saving ? <Loader2 aria-hidden='true' /> : null}
                                {t('Save to group')}
                            </button>
                        </div>
                        {saveError && (
                            <p className={styles.saveError} role='alert'>
                                {saveError}
                            </p>
                        )}
                        {addedPhotoId === selectedPhoto.assetId && (
                            <div className={styles.saved} role='status'>
                                <Check aria-hidden='true' />
                                <span>{t('Photo saved to character group')}</span>
                                <button type='button' onClick={props.onOpenVideo}>
                                    {t('Go to video')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <details className={styles.addPhotos} open={props.photos.length === 0 || undefined}>
                <summary>
                    <ImagePlus aria-hidden='true' /> {t('Add verified photo')} <ChevronDown aria-hidden='true' />
                </summary>
                <div className={styles.addRow}>
                    <AssetImageDropdown
                        ariaLabel={t('Image asset')}
                        assets={props.sourceAssets}
                        value={props.draft.assetKey}
                        onValueChange={(value, asset) =>
                            props.onDraftChange({ assetKey: value, name: props.draft.name || asset?.name || '' })
                        }
                        disabled={props.busy}
                        placeholder={t('Choose image asset')}
                        labelFor={(asset) => asset.name || t('Image')}
                    />
                    <input
                        value={props.draft.name}
                        placeholder={t('Photo name')}
                        aria-label={t('Photo name')}
                        onChange={(event) => props.onDraftChange({ name: event.target.value })}
                        disabled={props.busy}
                    />
                    <button type='button' disabled={props.busy || !props.draft.assetKey} onClick={props.onAddPhoto}>
                        {t('Add verified photo')}
                    </button>
                    <input
                        ref={photoInput}
                        type='file'
                        accept='image/png,image/jpeg,image/webp'
                        hidden
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (!file) return;
                            setUploadError('');
                            void props.onUploadPhoto(file).catch((error: unknown) => {
                                setUploadError(error instanceof Error ? error.message : t('Unknown error'));
                            });
                        }}
                    />
                    <button
                        type='button'
                        className={styles.primaryButton}
                        disabled={props.busy || !props.canUpload}
                        onClick={() => photoInput.current?.click()}>
                        {props.busy ? <Loader2 aria-hidden='true' /> : <ImagePlus aria-hidden='true' />}
                        {t('Upload photo')}
                    </button>
                </div>
                {uploadError && (
                    <p className={styles.uploadError} role='alert'>
                        {t('Could not upload photo<colon> <lcur>error<rcur>', { error: uploadError })}
                    </p>
                )}
            </details>
        </section>
    );
}
