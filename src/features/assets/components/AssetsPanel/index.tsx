'use client';

import { AssetStrip } from './AssetStrip';
import { AuthorizationListItem } from './AuthorizationListItem';
import { AuthorizationQueueCard } from './AuthorizationQueueCard';
import { AuthorizationReferenceSelect } from './AuthorizationReferenceSelect';
import { CharacterDialog } from './CharacterDialog';
import { CopyUrlButton } from './CopyUrlButton';
import type { AssetsPanelProps, AuthorizationTargetOption } from './types';
import {
    buildAuthorizationTargets,
    defaultCharacterName,
    formatBytes,
    formatDate,
    portraitCollections,
    portraitGroupLabel,
    shortAssetId
} from './utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import type {
    AuthorizationItem,
    AuthorizationQueueItem,
    AuthorizationReviewAction
} from '@/features/assets/authorization/api';
import { AssetIdIntake } from '@/features/assets/components/AssetIdIntake';
import { useProcessingPortraitRefresh } from '@/features/assets/hooks/use-processing-portrait-refresh';
import { validateAssetImage } from '@/features/assets/image/validation';
import type { PortraitGroup, PortraitGroupType } from '@/features/assets/portrait/api';
import { createAndTrackPortraitAsset } from '@/features/assets/portrait/track';
import type { UserAsset } from '@/lib/media-archive';
import { ImagePlus, Loader2, Music, RefreshCw, ShieldCheck, Sparkles, Trash2, UserPlus, Video } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

export function AssetsPanel({
    loadAssets,
    deleteAsset,
    loadAuthorizations,
    submitAuthorization,
    loadAuthorizationQueue,
    reviewAuthorization,
    fetchAuthorizationDoc,
    authorizationTargets,
    selectedAuthorizationReferenceKey,
    onAuthorizationSubmitted,
    characters,
    addCharacter,
    removeCharacter,
    portraitEnabled,
    portraits,
    declarations,
    addPortrait,
    syncPortraitState,
    removePortrait,
    startPortraitSession,
    loadPortraitGroups,
    createPortraitGroup,
    createPortraitAsset,
    getPortraitAsset,
    getPortraitStatus,
    onUseAsReference,
    onUseAsReferenceVideo,
    onAttachAssetId,
    onMarkReferenceForAuthorization,
    active
}: AssetsPanelProps) {
    const t = useTranslations();
    const locale = useLocale();
    const loadAssetsError = t('Could not load assets');
    const loadAuthorizationsError = t('Could not load authorizations');
    const loadPortraitGroupsError = t('Could not load portrait groups');
    const assetsSignInError = t('Sign in at xcity<dot>ai or set an API key to view your assets');
    const authorizationsSignInError = t('Sign in at xcity<dot>ai or set an API key to view your authorizations');
    const characterFallback = t('Character');
    const imageAssetLabel = t('Image asset');
    const videoAssetLabel = t('Video asset');
    const assetCharacterName = (asset: UserAsset) => defaultCharacterName(asset, characterFallback);
    const [assets, setAssets] = React.useState<UserAsset[] | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [kindFilter, setKindFilter] = React.useState<'all' | 'image' | 'audio' | 'video'>('all');
    const [authorizations, setAuthorizations] = React.useState<AuthorizationItem[] | null>(null);
    const [authorizationQueue, setAuthorizationQueue] = React.useState<AuthorizationQueueItem[] | null>(null);
    const [isLoadingAuthorizations, setIsLoadingAuthorizations] = React.useState(false);
    const [authorizationError, setAuthorizationError] = React.useState<string | null>(null);
    const [authorizationNotice, setAuthorizationNotice] = React.useState<string | null>(null);
    const [authorizationReferenceKey, setAuthorizationReferenceKey] = React.useState('');
    const [authorizationSubjectName, setAuthorizationSubjectName] = React.useState('');
    const [authorizationNote, setAuthorizationNote] = React.useState('');
    const [authorizationFile, setAuthorizationFile] = React.useState<File | null>(null);
    const [isSubmittingAuthorization, setIsSubmittingAuthorization] = React.useState(false);
    const [reviewingAuthorizationId, setReviewingAuthorizationId] = React.useState<string | null>(null);
    const [authorizationReviewNotes, setAuthorizationReviewNotes] = React.useState<Record<string, string>>({});
    const authorizationFileInputRef = React.useRef<HTMLInputElement>(null);
    const [characterAsset, setCharacterAsset] = React.useState<UserAsset | null>(null);
    const [characterName, setCharacterName] = React.useState('');
    const [portraitGroups, setPortraitGroups] = React.useState<PortraitGroup[] | null>(null);
    const [isLoadingPortraitGroups, setIsLoadingPortraitGroups] = React.useState(false);
    const [isStartingPortraitSession, setIsStartingPortraitSession] = React.useState(false);
    const [isCreatingVirtualGroup, setIsCreatingVirtualGroup] = React.useState(false);
    const [virtualCharacterName, setVirtualCharacterName] = React.useState('');
    const [portraitError, setPortraitError] = React.useState<string | null>(null);
    const [portraitNotice, setPortraitNotice] = React.useState<string | null>(null);
    const [addingPortraitGroupId, setAddingPortraitGroupId] = React.useState<string | null>(null);
    const [portraitDrafts, setPortraitDrafts] = React.useState<Record<string, { assetKey: string; name: string }>>({});
    const [portraitStatus, setPortraitStatus] = React.useState<string | null>(null);
    const [isCheckingPortraitSetup, setIsCheckingPortraitSetup] = React.useState(false);
    const uploadedAuthorizationTargets = React.useMemo<AuthorizationTargetOption[]>(
        () => buildAuthorizationTargets(assets, imageAssetLabel, videoAssetLabel, locale),
        [assets, imageAssetLabel, locale, videoAssetLabel]
    );
    const authorizationTargetOptions = React.useMemo<AuthorizationTargetOption[]>(() => {
        const seen = new Set<string>();
        return [...authorizationTargets, ...uploadedAuthorizationTargets].filter((target) => {
            if (seen.has(target.key)) return false;
            seen.add(target.key);
            return true;
        });
    }, [authorizationTargets, uploadedAuthorizationTargets]);

    const checkPortraitSetup = async () => {
        setIsCheckingPortraitSetup(true);
        setPortraitStatus(null);
        try {
            const status = await getPortraitStatus();
            setPortraitStatus(
                status.ok
                    ? t('Portrait libraries ready for project <lcur>projectName<rcur>', {
                          projectName: status.projectName
                      })
                    : t('Portrait libraries unavailable<colon> <lcur>error<rcur>', {
                          error: t('Unknown error')
                      })
            );
        } catch (err) {
            setPortraitStatus(t('Setup check failed'));
        } finally {
            setIsCheckingPortraitSetup(false);
        }
    };

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setAssets(await loadAssets());
        } catch (err) {
            setError(
                err instanceof Error && err.message.includes('Sign in at xcity.ai')
                    ? assetsSignInError
                    : loadAssetsError
            );
        } finally {
            setIsLoading(false);
        }
    }, [assetsSignInError, loadAssets, loadAssetsError]);

    const refreshAuthorizations = React.useCallback(async () => {
        setIsLoadingAuthorizations(true);
        setAuthorizationError(null);
        const queuePromise = loadAuthorizationQueue().catch((err) => {
            console.warn('Could not load authorization review queue:', err);
            return null;
        });

        try {
            const [loadedItems, loadedQueue] = await Promise.all([loadAuthorizations(), queuePromise]);
            setAuthorizations(loadedItems);
            setAuthorizationQueue(loadedQueue);
        } catch (err) {
            setAuthorizationError(
                err instanceof Error && err.message.includes('Sign in at xcity.ai')
                    ? authorizationsSignInError
                    : loadAuthorizationsError
            );
        } finally {
            setIsLoadingAuthorizations(false);
        }
    }, [authorizationsSignInError, loadAuthorizationQueue, loadAuthorizations, loadAuthorizationsError]);

    const refreshPortraitGroups = React.useCallback(async () => {
        if (!portraitEnabled) return;
        setIsLoadingPortraitGroups(true);
        setPortraitError(null);
        try {
            setPortraitGroups(await loadPortraitGroups('all'));
        } catch (err) {
            setPortraitError(loadPortraitGroupsError);
        } finally {
            setIsLoadingPortraitGroups(false);
        }
    }, [loadPortraitGroups, loadPortraitGroupsError, portraitEnabled]);

    // First fetch happens when the tab first becomes visible.
    const fetchedRef = React.useRef(false);
    React.useEffect(() => {
        if (active && !fetchedRef.current) {
            fetchedRef.current = true;
            void refresh();
            void refreshAuthorizations();
        }
    }, [active, refresh, refreshAuthorizations]);

    React.useEffect(() => {
        if (
            selectedAuthorizationReferenceKey &&
            authorizationTargetOptions.some((target) => target.key === selectedAuthorizationReferenceKey)
        ) {
            setAuthorizationReferenceKey(selectedAuthorizationReferenceKey);
            return;
        }
        setAuthorizationReferenceKey((current) =>
            current && authorizationTargetOptions.some((target) => target.key === current)
                ? current
                : (authorizationTargetOptions[0]?.key ?? '')
        );
    }, [authorizationTargetOptions, selectedAuthorizationReferenceKey]);

    const fetchedPortraitGroupsRef = React.useRef(false);
    React.useEffect(() => {
        if (active && portraitEnabled && !fetchedPortraitGroupsRef.current) {
            fetchedPortraitGroupsRef.current = true;
            void refreshPortraitGroups();
        }
    }, [active, portraitEnabled, refreshPortraitGroups]);

    const handleDelete = async (asset: UserAsset) => {
        if (
            !confirm(
                t('Delete this <lcur>kind<rcur> from cloud storage<q> Its links will stop working', {
                    kind: asset.kind
                })
            )
        )
            return;
        try {
            await deleteAsset(asset.key);
            setAssets((prev) => prev?.filter((a) => a.key !== asset.key) ?? prev);
        } catch (err) {
            setError(t('Delete failed'));
        }
    };

    const openCharacterDialog = (asset: UserAsset) => {
        setCharacterAsset(asset);
        setCharacterName(assetCharacterName(asset));
    };

    const handleCharacterDialogOpenChange = (open: boolean) => {
        if (open) return;
        setCharacterAsset(null);
        setCharacterName('');
    };

    const handleSaveCharacter = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!characterAsset) return;
        const name = characterName.trim();
        if (!name) return;
        addCharacter({ id: crypto.randomUUID(), name, url: characterAsset.url });
        handleCharacterDialogOpenChange(false);
    };

    const { imageAssets, livenessGroups, reviewedMaterials, virtualGroups, verifiedPortraits, virtualPortraits } =
        React.useMemo(
            () => portraitCollections(assets, portraitGroups, portraits, declarations),
            [assets, declarations, portraitGroups, portraits]
        );
    useProcessingPortraitRefresh({
        active,
        enabled: portraitEnabled,
        portraits,
        getAsset: getPortraitAsset,
        savePortrait: addPortrait,
        syncState: syncPortraitState
    });

    const updatePortraitDraft = React.useCallback(
        (groupId: string, patch: Partial<{ assetKey: string; name: string }>) => {
            setPortraitDrafts((prev) => ({
                ...prev,
                [groupId]: {
                    assetKey: prev[groupId]?.assetKey ?? '',
                    name: prev[groupId]?.name ?? '',
                    ...patch
                }
            }));
        },
        []
    );

    const handleStartPortraitSession = async () => {
        setIsStartingPortraitSession(true);
        setPortraitError(null);
        setPortraitNotice(null);
        try {
            const session = await startPortraitSession(window.location.origin);
            window.open(session.h5Link, '_blank', 'noopener,noreferrer');
            setPortraitNotice(t('Complete verification in the opened page<comma> then return'));
        } catch (err) {
            setPortraitError(t('Could not start verification'));
        } finally {
            setIsStartingPortraitSession(false);
        }
    };

    const handleCreateVirtualGroup = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = virtualCharacterName.trim();
        if (!name) return;

        setIsCreatingVirtualGroup(true);
        setPortraitError(null);
        setPortraitNotice(null);
        try {
            const result = await createPortraitGroup(name);
            setVirtualCharacterName('');
            setPortraitNotice(
                result.created
                    ? t('Virtual character <lcur>name<rcur> created', { name: result.slug })
                    : t('Using existing virtual character <lcur>name<rcur>', { name: result.slug })
            );
            await refreshPortraitGroups();
        } catch (err) {
            setPortraitError(t('Could not create virtual character'));
        } finally {
            setIsCreatingVirtualGroup(false);
        }
    };

    const handleAddPortraitAsset = async (groupId: string, groupType: PortraitGroupType) => {
        const draft = portraitDrafts[groupId];
        const selected = imageAssets.find((asset) => asset.key === draft?.assetKey);
        if (!selected) {
            setPortraitError(t('Choose an image asset first'));
            return;
        }

        const name = draft?.name.trim() || assetCharacterName(selected);
        setAddingPortraitGroupId(groupId);
        setPortraitError(null);
        setPortraitNotice(null);
        try {
            const validation = await validateAssetImage(selected.url);
            if (validation.status === 'rejected') {
                throw new Error(
                    t(
                        'Studio could not use the reference image<dot> Please check the image size<comma> format<comma> and content<comma> then try again'
                    )
                );
            }
            if (validation.status === 'unknown') {
                setPortraitNotice(t('Studio will validate this image after submission'));
            }

            await createAndTrackPortraitAsset(
                {
                    groupId,
                    groupType,
                    referenceOrigin: groupType === 'AIGC' ? 'thirdparty-ai' : 'real-person',
                    name,
                    thumbUrl: selected.url
                },
                () => createPortraitAsset({ groupId, url: selected.url, name, assetType: 'Image' }),
                getPortraitAsset,
                addPortrait,
                syncPortraitState
            );
            setPortraitNotice(groupType === 'AIGC' ? t('Virtual character image added') : t('Verified photo added'));
            setPortraitDrafts((prev) => ({
                ...prev,
                [groupId]: { assetKey: '', name: '' }
            }));
        } catch (err) {
            setPortraitNotice(null);
            setPortraitError(t('Could not add portrait image'));
        } finally {
            setAddingPortraitGroupId(null);
        }
    };

    const handleSubmitAuthorization = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const referenceKey = authorizationReferenceKey.trim();
        const subjectName = authorizationSubjectName.trim();
        const note = authorizationNote.trim();
        if (!referenceKey) {
            setAuthorizationError(t('Choose a licensed reference image first'));
            return;
        }
        if (!subjectName) {
            setAuthorizationError(t('Enter the public figure or character name'));
            return;
        }
        if (!authorizationFile) {
            setAuthorizationError(t('Choose a PDF<comma> PNG<comma> JPEG<comma> or WebP authorization document'));
            return;
        }

        setIsSubmittingAuthorization(true);
        setAuthorizationError(null);
        setAuthorizationNotice(null);
        try {
            const created = await submitAuthorization({
                subjectName,
                referenceKey,
                note,
                file: authorizationFile
            });
            onAuthorizationSubmitted(referenceKey, created.id);
            setAuthorizationSubjectName('');
            setAuthorizationNote('');
            setAuthorizationFile(null);
            if (authorizationFileInputRef.current) authorizationFileInputRef.current.value = '';
            setAuthorizationNotice(
                t('Authorization submitted for review<dot> Studio approval does not replace final model moderation')
            );
            await refreshAuthorizations();
        } catch (err) {
            setAuthorizationError(t('Authorization submission failed'));
        } finally {
            setIsSubmittingAuthorization(false);
        }
    };

    const handleReviewAuthorization = async (item: AuthorizationQueueItem, action: AuthorizationReviewAction) => {
        setReviewingAuthorizationId(`${item.id}:${action}`);
        setAuthorizationError(null);
        try {
            await reviewAuthorization(item.id, action, authorizationReviewNotes[item.id]?.trim() ?? '');
            setAuthorizationQueue((prev) => prev?.filter((candidate) => candidate.id !== item.id) ?? prev);
            setAuthorizations(await loadAuthorizations());
        } catch (err) {
            setAuthorizationError(t('Authorization review failed'));
        } finally {
            setReviewingAuthorizationId(null);
        }
    };

    const visible = (assets ?? []).filter((a) => kindFilter === 'all' || a.kind === kindFilter);
    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CharacterDialog
                name={characterName}
                open={Boolean(characterAsset)}
                onNameChange={setCharacterName}
                onOpenChange={handleCharacterDialogOpenChange}
                onSubmit={handleSaveCharacter}
            />
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/10 px-4 py-3'>
                <div>
                    <CardTitle className='text-lg font-medium text-white'>{t('Assets')}</CardTitle>
                    <CardDescription className='mt-1 text-white/60'>
                        {t('Uploaded reference media and cloud<dash>archived videos')}
                    </CardDescription>
                </div>
                <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                        void refresh();
                        void refreshAuthorizations();
                    }}
                    disabled={isLoading || isLoadingAuthorizations}
                    className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                    <RefreshCw
                        size={14}
                        className={isLoading || isLoadingAuthorizations ? 'animate-spin' : undefined}
                    />
                    <span className='ml-1'>{t('Refresh')}</span>
                </Button>
            </CardHeader>
            <CardContent className='flex-grow overflow-y-auto p-4'>
                {error && <p className='mb-3 text-sm text-red-400'>{error}</p>}
                <AssetIdIntake onAttachAssetId={onAttachAssetId} />

                {!portraitEnabled && (
                    <div className='mb-4 space-y-2 border-b border-white/10 pb-4'>
                        <h3 className='text-xs font-medium text-white/50'>{t('Verified people')}</h3>
                        <p className='text-xs text-white/40'>
                            {t('Real people require consent and face verification before their images can be used')}
                        </p>
                        <button
                            type='button'
                            onClick={() => void checkPortraitSetup()}
                            disabled={isCheckingPortraitSetup}
                            className='text-xs text-white/40 underline transition-colors hover:text-white/70 disabled:opacity-50'>
                            {isCheckingPortraitSetup ? t('Checking') : t('Check setup')}
                        </button>
                        {portraitStatus && <p className='text-xs text-white/50'>{portraitStatus}</p>}
                    </div>
                )}

                {portraitEnabled && (
                    <div className='mb-4 space-y-3 border-b border-white/10 pb-4'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <h3 className='text-xs font-medium text-white/50'>{t('Verified people')}</h3>
                            <div className='flex items-center gap-1.5'>
                                <button
                                    type='button'
                                    onClick={() => void checkPortraitSetup()}
                                    disabled={isCheckingPortraitSetup}
                                    className='rounded-md px-2 py-1 text-xs text-white/40 transition-colors hover:bg-white/10 hover:text-white/70 disabled:opacity-50'>
                                    {isCheckingPortraitSetup ? t('Checking') : t('Check setup')}
                                </button>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => void refreshPortraitGroups()}
                                    disabled={isLoadingPortraitGroups}
                                    className='h-auto rounded-md px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white'>
                                    <RefreshCw
                                        size={13}
                                        className={isLoadingPortraitGroups ? 'animate-spin' : undefined}
                                    />
                                    <span className='ml-1'>{t('Refresh')}</span>
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    onClick={() => void handleStartPortraitSession()}
                                    disabled={isStartingPortraitSession}
                                    className='h-auto bg-white px-2 py-1 text-xs text-black hover:bg-white/90 disabled:bg-white/40'>
                                    {isStartingPortraitSession ? (
                                        <Loader2 className='h-3 w-3 animate-spin' />
                                    ) : (
                                        <ShieldCheck className='h-3 w-3' />
                                    )}
                                    {t('Verify a real person')}
                                </Button>
                            </div>
                        </div>

                        {portraitNotice && <p className='text-xs text-emerald-300'>{portraitNotice}</p>}
                        {portraitStatus && <p className='text-xs text-white/50'>{portraitStatus}</p>}
                        {portraitError && <p className='text-xs text-red-400'>{portraitError}</p>}

                        <AssetStrip assets={verifiedPortraits} kind='verified' onRemove={removePortrait} />

                        {isLoadingPortraitGroups && portraitGroups === null ? (
                            <div className='flex items-center gap-2 text-xs text-white/40'>
                                <Loader2 className='h-3 w-3 animate-spin' />
                                {t('Loading verified groups')}
                            </div>
                        ) : portraitGroups && livenessGroups.length > 0 ? (
                            <div className='space-y-2'>
                                {livenessGroups.map((group) => {
                                    const draft = portraitDrafts[group.id] ?? { assetKey: '', name: '' };
                                    const isAdding = addingPortraitGroupId === group.id;
                                    return (
                                        <div
                                            key={group.id}
                                            className='space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-2'>
                                            <div className='flex items-center justify-between gap-2'>
                                                <div className='flex min-w-0 items-center gap-1.5 text-xs text-white/70'>
                                                    <ShieldCheck className='h-3.5 w-3.5 shrink-0 text-emerald-300' />
                                                    <span className='truncate'>
                                                        {t('Group <lcur>id<rcur>', { id: shortAssetId(group.id) })}
                                                    </span>
                                                </div>
                                                <span className='text-[10px] text-white/35'>{group.name}</span>
                                            </div>
                                            <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto]'>
                                                <Dropdown
                                                    ariaLabel={t('Image asset')}
                                                    value={draft.assetKey}
                                                    onValueChange={(value) => {
                                                        const asset = imageAssets.find(
                                                            (candidate) => candidate.key === value
                                                        );
                                                        updatePortraitDraft(group.id, {
                                                            assetKey: value,
                                                            name: draft.name || (asset ? assetCharacterName(asset) : '')
                                                        });
                                                    }}
                                                    disabled={isAdding || imageAssets.length === 0}
                                                    size='sm'
                                                    options={[
                                                        { value: '', label: t('Choose image asset') },
                                                        ...imageAssets.map((asset) => ({
                                                            value: asset.key,
                                                            label: asset.name || assetCharacterName(asset)
                                                        }))
                                                    ]}
                                                />
                                                <Input
                                                    value={draft.name}
                                                    onChange={(event) =>
                                                        updatePortraitDraft(group.id, { name: event.target.value })
                                                    }
                                                    placeholder={t('Name')}
                                                    disabled={isAdding}
                                                    className='h-8 rounded-md border border-white/20 bg-black text-xs text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                                />
                                                <Button
                                                    type='button'
                                                    size='sm'
                                                    onClick={() =>
                                                        void handleAddPortraitAsset(group.id, 'LivenessFace')
                                                    }
                                                    disabled={isAdding || !draft.assetKey}
                                                    className='h-8 bg-white text-xs text-black hover:bg-white/90 disabled:bg-white/40'>
                                                    {isAdding ? (
                                                        <Loader2 className='h-3 w-3 animate-spin' />
                                                    ) : (
                                                        <ImagePlus className='h-3 w-3' />
                                                    )}
                                                    {t('Add verified photo')}
                                                </Button>
                                            </div>
                                            {imageAssets.length === 0 && (
                                                <p className='text-[10px] text-white/35'>
                                                    {t('Upload or save an image asset first')}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className='text-xs text-white/40'>
                                {t('No verified groups yet<dot> Complete verification<comma> then refresh')}
                            </p>
                        )}

                        {reviewedMaterials.length > 0 && (
                            <div className='space-y-2 border-t border-white/10 pt-4'>
                                <h3 className='text-xs font-medium text-white/50'>{t('Reviewed materials')}</h3>
                                <p className='text-xs text-white/40'>
                                    {t(
                                        'Materials submitted from the video form remain available here with their provider status'
                                    )}
                                </p>
                                <AssetStrip assets={reviewedMaterials} kind='reviewed' onRemove={removePortrait} />
                            </div>
                        )}

                        <div className='space-y-3 border-t border-white/10 pt-4'>
                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                <div className='min-w-0 flex-1'>
                                    <h3 className='text-xs font-medium text-white/50'>{t('Virtual characters')}</h3>
                                    <p className='mt-1 text-xs text-white/40'>
                                        {t('Group multiple images of one character to keep it consistent across shots')}
                                    </p>
                                </div>
                                <form
                                    onSubmit={(event) => void handleCreateVirtualGroup(event)}
                                    className='flex min-w-0 flex-1 gap-2 sm:max-w-sm'>
                                    <Input
                                        value={virtualCharacterName}
                                        onChange={(event) => setVirtualCharacterName(event.target.value)}
                                        placeholder={t('Character name')}
                                        disabled={isCreatingVirtualGroup}
                                        className='h-8 min-w-0 rounded-md border border-white/20 bg-black text-xs text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                    />
                                    <Button
                                        type='submit'
                                        size='sm'
                                        disabled={isCreatingVirtualGroup || !virtualCharacterName.trim()}
                                        className='h-8 shrink-0 bg-white text-xs text-black hover:bg-white/90 disabled:bg-white/40'>
                                        {isCreatingVirtualGroup ? (
                                            <Loader2 className='h-3 w-3 animate-spin' />
                                        ) : (
                                            <Sparkles className='h-3 w-3' />
                                        )}
                                        {t('Create virtual character')}
                                    </Button>
                                </form>
                            </div>

                            <AssetStrip assets={virtualPortraits} kind='virtual' onRemove={removePortrait} />

                            {isLoadingPortraitGroups && portraitGroups === null ? (
                                <div className='flex items-center gap-2 text-xs text-white/40'>
                                    <Loader2 className='h-3 w-3 animate-spin' />
                                    {t('Loading virtual characters')}
                                </div>
                            ) : portraitGroups && virtualGroups.length > 0 ? (
                                <div className='space-y-2'>
                                    {virtualGroups.map((group) => {
                                        const draft = portraitDrafts[group.id] ?? { assetKey: '', name: '' };
                                        const isAdding = addingPortraitGroupId === group.id;
                                        const groupLabel = t('Group <lcur>id<rcur>', { id: shortAssetId(group.id) });
                                        return (
                                            <div
                                                key={group.id}
                                                className='space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-2'>
                                                <div className='flex items-center justify-between gap-2'>
                                                    <div className='flex min-w-0 items-center gap-1.5 text-xs text-white/70'>
                                                        <Sparkles className='h-3.5 w-3.5 shrink-0 text-cyan-200' />
                                                        <span className='truncate'>
                                                            {portraitGroupLabel(group, groupLabel)}
                                                        </span>
                                                    </div>
                                                    <span className='text-[10px] text-white/35'>
                                                        {t('Group <lcur>id<rcur>', { id: shortAssetId(group.id) })}
                                                    </span>
                                                </div>
                                                <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto]'>
                                                    <Dropdown
                                                        ariaLabel={t('Virtual character image asset')}
                                                        value={draft.assetKey}
                                                        onValueChange={(value) => {
                                                            const asset = imageAssets.find(
                                                                (candidate) => candidate.key === value
                                                            );
                                                            updatePortraitDraft(group.id, {
                                                                assetKey: value,
                                                                name:
                                                                    draft.name ||
                                                                    (asset ? assetCharacterName(asset) : '')
                                                            });
                                                        }}
                                                        disabled={isAdding || imageAssets.length === 0}
                                                        size='sm'
                                                        options={[
                                                            { value: '', label: t('Choose image asset') },
                                                            ...imageAssets.map((asset) => ({
                                                                value: asset.key,
                                                                label: asset.name || assetCharacterName(asset)
                                                            }))
                                                        ]}
                                                    />
                                                    <Input
                                                        value={draft.name}
                                                        onChange={(event) =>
                                                            updatePortraitDraft(group.id, { name: event.target.value })
                                                        }
                                                        placeholder={t('Name')}
                                                        disabled={isAdding}
                                                        className='h-8 rounded-md border border-white/20 bg-black text-xs text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                                    />
                                                    <Button
                                                        type='button'
                                                        size='sm'
                                                        onClick={() => void handleAddPortraitAsset(group.id, 'AIGC')}
                                                        disabled={isAdding || !draft.assetKey}
                                                        className='h-8 bg-white text-xs text-black hover:bg-white/90 disabled:bg-white/40'>
                                                        {isAdding ? (
                                                            <Loader2 className='h-3 w-3 animate-spin' />
                                                        ) : (
                                                            <ImagePlus className='h-3 w-3' />
                                                        )}
                                                        {t('Add character image')}
                                                    </Button>
                                                </div>
                                                {imageAssets.length === 0 && (
                                                    <p className='text-[10px] text-white/35'>
                                                        {t('Upload or save an image asset first')}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className='text-xs text-white/40'>
                                    {t('No virtual characters yet<dot> Create one<comma> then add uploaded images')}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className='mb-4 space-y-4 border-b border-white/10 pb-4'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div className='min-w-0 flex-1'>
                            <h3 className='text-sm font-medium text-white'>{t('Licensed characters')}</h3>
                            <p className='mt-1 max-w-4xl text-xs leading-5 text-white/45'>
                                {t(
                                    'Submit proof for public figures or protected IP<dot> Studio approval does not replace final model moderation'
                                )}
                            </p>
                        </div>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => void refreshAuthorizations()}
                            disabled={isLoadingAuthorizations}
                            className='h-auto rounded-md px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white'>
                            <RefreshCw size={13} className={isLoadingAuthorizations ? 'animate-spin' : undefined} />
                            <span className='ml-1'>{t('Refresh')}</span>
                        </Button>
                    </div>

                    {authorizationNotice && <p className='text-xs text-emerald-300'>{authorizationNotice}</p>}
                    {authorizationError && <p className='text-xs text-red-400'>{authorizationError}</p>}

                    {authorizationQueue !== null && (
                        <section className='space-y-3 rounded-md border border-white/10 bg-white/[0.03] p-3'>
                            <div className='flex items-center justify-between gap-3'>
                                <h4 className='text-sm font-medium text-white'>
                                    {t('Authorization review queue <lpar><lcur>count<rcur><rpar>', {
                                        count: authorizationQueue.length
                                    })}
                                </h4>
                            </div>
                            {authorizationQueue.length === 0 ? (
                                <p className='text-sm text-white/40'>
                                    {t('No authorization submissions waiting for review')}
                                </p>
                            ) : (
                                <div className='grid gap-3 lg:grid-cols-2'>
                                    {authorizationQueue.map((item) => (
                                        <AuthorizationQueueCard
                                            key={item.id}
                                            item={item}
                                            reviewingId={reviewingAuthorizationId}
                                            reviewNote={authorizationReviewNotes[item.id] ?? ''}
                                            onReviewNoteChange={(id, note) =>
                                                setAuthorizationReviewNotes((prev) => ({ ...prev, [id]: note }))
                                            }
                                            onReview={handleReviewAuthorization}
                                            fetchAuthorizationDoc={fetchAuthorizationDoc}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    <form onSubmit={(event) => void handleSubmitAuthorization(event)} className='max-w-5xl space-y-4'>
                        <div className='flex items-start gap-2'>
                            <ShieldCheck className='mt-0.5 h-4 w-4 shrink-0 text-amber-200/80' />
                            <div className='min-w-0'>
                                <h4 className='text-sm font-medium text-white'>{t('Submit authorization')}</h4>
                                <p className='mt-0.5 text-xs text-white/40'>
                                    {t(
                                        'Select the reference<comma> name the subject<comma> and attach proof of authorization'
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className='grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(12rem,0.85fr)]'>
                            <div className='space-y-1.5'>
                                <Label htmlFor='authorization-reference' className='text-xs text-white/70'>
                                    {t('Reference media')}
                                </Label>
                                {authorizationTargetOptions.length > 0 ? (
                                    <AuthorizationReferenceSelect
                                        id='authorization-reference'
                                        value={authorizationReferenceKey}
                                        options={authorizationTargetOptions}
                                        disabled={isSubmittingAuthorization}
                                        onValueChange={setAuthorizationReferenceKey}
                                    />
                                ) : (
                                    <div className='rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3'>
                                        <p className='text-xs leading-5 text-amber-100/80'>
                                            {t(
                                                'Mark a reference as a public figure or protected IP<comma> or upload it to Assets'
                                            )}
                                        </p>
                                        {onMarkReferenceForAuthorization && (
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={onMarkReferenceForAuthorization}
                                                className='mt-2 h-8 rounded-md border border-amber-200/20 px-2 text-xs text-amber-100 hover:bg-amber-200/10 hover:text-white'>
                                                {t('Go to reference image')}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className='space-y-1.5'>
                                <Label htmlFor='authorization-subject' className='text-xs text-white/70'>
                                    {t('Subject name')}
                                </Label>
                                <Input
                                    id='authorization-subject'
                                    value={authorizationSubjectName}
                                    onChange={(event) => setAuthorizationSubjectName(event.target.value)}
                                    placeholder={t('Public figure or character name')}
                                    disabled={isSubmittingAuthorization || authorizationTargetOptions.length === 0}
                                    className='h-10 rounded-md border border-white/20 bg-black text-sm text-white placeholder:text-white/35 focus:border-white/50 focus:ring-white/50'
                                />
                            </div>
                        </div>
                        <div className='space-y-1.5'>
                            <Label htmlFor='authorization-note' className='text-xs text-white/70'>
                                {t('Note')}
                            </Label>
                            <textarea
                                id='authorization-note'
                                value={authorizationNote}
                                onChange={(event) => setAuthorizationNote(event.target.value)}
                                placeholder={t('Agreement summary<comma> usage scope<comma> and reviewer context')}
                                disabled={isSubmittingAuthorization || authorizationTargetOptions.length === 0}
                                className='min-h-20 w-full resize-y rounded-md border border-white/20 bg-black px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-white/50 focus:ring-white/50'
                            />
                        </div>
                        <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start'>
                            <div className='space-y-1.5'>
                                <Label htmlFor='authorization-doc' className='text-xs text-white/70'>
                                    {t('Authorization document')}
                                </Label>
                                <Input
                                    ref={authorizationFileInputRef}
                                    id='authorization-doc'
                                    type='file'
                                    accept='application/pdf,image/png,image/jpeg,image/webp'
                                    onChange={(event) => setAuthorizationFile(event.target.files?.[0] ?? null)}
                                    disabled={isSubmittingAuthorization || authorizationTargetOptions.length === 0}
                                    className='h-10 rounded-md border border-white/20 bg-black text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/20 disabled:opacity-40'
                                />
                                <p className='text-[10px] text-white/35'>
                                    {t('PDF<comma> PNG<comma> JPEG<comma> or WebP up to 5 MB')}
                                </p>
                            </div>
                            <Button
                                type='submit'
                                disabled={
                                    isSubmittingAuthorization ||
                                    authorizationTargetOptions.length === 0 ||
                                    !authorizationReferenceKey ||
                                    !authorizationSubjectName.trim() ||
                                    !authorizationFile
                                }
                                className='mt-5 h-10 min-w-40 bg-white px-4 text-sm text-black hover:bg-white/90 disabled:bg-white/40 md:mt-[1.375rem]'>
                                {isSubmittingAuthorization ? (
                                    <Loader2 className='h-3 w-3 animate-spin' />
                                ) : (
                                    <ShieldCheck className='h-3 w-3' />
                                )}
                                {t('Submit for review')}
                            </Button>
                        </div>
                    </form>

                    <div className='space-y-3'>
                        <div className='flex items-center justify-between gap-2'>
                            <h4 className='text-sm font-medium text-white'>{t('Your submissions')}</h4>
                            {isLoadingAuthorizations && (
                                <span className='inline-flex items-center gap-1 text-[10px] text-white/40'>
                                    <Loader2 className='h-3 w-3 animate-spin' />
                                    {t('Loading')}
                                </span>
                            )}
                        </div>
                        {authorizations === null && isLoadingAuthorizations ? (
                            <div className='flex items-center gap-2 text-xs text-white/40'>
                                <Loader2 className='h-3 w-3 animate-spin' />
                                {t('Loading authorizations')}
                            </div>
                        ) : (authorizations ?? []).length === 0 ? (
                            <p className='text-xs text-white/40'>{t('No authorization submissions yet')}</p>
                        ) : (
                            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                                {(authorizations ?? []).map((item) => (
                                    <AuthorizationListItem
                                        key={item.id}
                                        item={item}
                                        fetchAuthorizationDoc={fetchAuthorizationDoc}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {characters.length > 0 && (
                    <div className='mb-4 space-y-2'>
                        <h3 className='text-xs font-medium text-white/50'>{t('Characters')}</h3>
                        <div className='flex gap-2 overflow-x-auto pb-1'>
                            {characters.map((character) => (
                                <div
                                    key={character.id}
                                    className='flex shrink-0 items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1.5'>
                                    <div className='h-7 w-7 overflow-hidden rounded border border-white/15 bg-white/5'>
                                        {/* eslint-disable-next-line @next/next/no-img-element -- worker-hosted URL */}
                                        <img
                                            src={character.url}
                                            alt={character.name}
                                            loading='lazy'
                                            className='h-full w-full object-cover'
                                        />
                                    </div>
                                    <span className='max-w-32 truncate text-xs text-white/80'>{character.name}</span>
                                    <button
                                        type='button'
                                        title={t('Remove character')}
                                        aria-label={t('Remove character <lcur>name<rcur>', { name: character.name })}
                                        onClick={() => removeCharacter(character.id)}
                                        className='rounded p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white'>
                                        <Trash2 className='h-3 w-3' />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className='mb-4 flex items-center gap-2'>
                    {(['all', 'image', 'audio', 'video'] as const).map((k) => (
                        <button
                            key={k}
                            type='button'
                            onClick={() => setKindFilter(k)}
                            className={
                                kindFilter === k
                                    ? 'rounded-full bg-white px-2.5 py-1 text-xs text-black'
                                    : 'rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/60 transition-colors hover:bg-white/20 hover:text-white'
                            }>
                            {k === 'all'
                                ? t('All')
                                : k === 'image'
                                  ? t('Images')
                                  : k === 'audio'
                                    ? t('Audio')
                                    : t('Videos')}
                        </button>
                    ))}
                </div>

                {isLoading && assets === null ? (
                    <div className='flex h-40 items-center justify-center text-white/40'>
                        <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                        {t('Loading assets')}
                    </div>
                ) : visible.length === 0 ? (
                    <div className='flex h-40 items-center justify-center text-white/40'>
                        <p>
                            {assets && assets.length > 0
                                ? t('No assets match the current filter')
                                : t('Nothing stored yet<dot> Uploaded references and archived videos will appear here')}
                        </p>
                    </div>
                ) : (
                    <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                        {visible.map((asset) => (
                            <div key={asset.key} className='flex h-full flex-col' title={asset.key}>
                                <div className='relative aspect-square w-full overflow-hidden rounded-t-md border border-white/20 bg-neutral-900'>
                                    {asset.kind === 'image' ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- worker-hosted URL
                                        <img
                                            src={asset.url}
                                            alt={asset.key}
                                            loading='lazy'
                                            className='h-full w-full object-cover'
                                        />
                                    ) : asset.kind === 'audio' ? (
                                        <div className='flex h-full w-full flex-col items-center justify-center gap-3 p-3'>
                                            <Music className='h-8 w-8 text-white/35' />
                                            <audio src={asset.url} controls preload='none' className='w-full' />
                                        </div>
                                    ) : (
                                        <video
                                            src={`${asset.url}#t=0.001`}
                                            className='h-full w-full object-cover'
                                            muted
                                            preload='metadata'
                                            playsInline
                                            onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.pause();
                                                e.currentTarget.currentTime = 0;
                                            }}
                                        />
                                    )}
                                    <span className='pointer-events-none absolute top-1 left-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white/80'>
                                        {asset.kind === 'image'
                                            ? t('Image')
                                            : asset.kind === 'audio'
                                              ? t('Audio')
                                              : t('Video')}
                                    </span>
                                    <button
                                        type='button'
                                        title={t('Delete from cloud storage')}
                                        onClick={() => void handleDelete(asset)}
                                        className='absolute top-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600/85 text-white shadow-sm transition-colors hover:bg-red-500'>
                                        <Trash2 size={12} />
                                    </button>
                                    <div className='pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-2 pt-8 pb-2'>
                                        <div className='h-4 truncate text-xs text-white/90'>
                                            {asset.name || asset.key.split('/').pop() || asset.key}
                                        </div>
                                        <div className='mt-1 flex h-4 items-center justify-between text-[10px] text-white/55'>
                                            <span>{asset.uploaded ? formatDate(asset.uploaded, locale) : ''}</span>
                                            <span>{formatBytes(asset.bytes)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className='rounded-b-md border border-t-0 border-white/20 bg-neutral-900/50 p-2'>
                                    <div
                                        className={
                                            asset.kind === 'image'
                                                ? 'grid grid-cols-3 gap-1.5'
                                                : 'grid grid-cols-2 gap-1.5'
                                        }>
                                        {asset.kind === 'image' && (
                                            <>
                                                <button
                                                    type='button'
                                                    title={t('Add to the video form as a reference image')}
                                                    onClick={() => onUseAsReference(asset.url)}
                                                    className='inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-md bg-white/10 px-2 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                    <ImagePlus size={11} />
                                                    {t('Use as reference')}
                                                </button>
                                                <CopyUrlButton url={asset.url} />
                                                <button
                                                    type='button'
                                                    title={t('Save this image as a named character')}
                                                    onClick={() => openCharacterDialog(asset)}
                                                    className='inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-md bg-white/10 px-2 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                    <UserPlus size={11} />
                                                    {t('Save as character')}
                                                </button>
                                            </>
                                        )}
                                        {asset.kind === 'video' && (
                                            <button
                                                type='button'
                                                title={t('Add to the video form as a reference video')}
                                                onClick={() => onUseAsReferenceVideo(asset.url)}
                                                className='inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-md bg-white/10 px-2 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                <Video size={11} />
                                                {t('Use as reference video')}
                                            </button>
                                        )}
                                        {asset.kind !== 'image' && <CopyUrlButton url={asset.url} />}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
