'use client';

import { AssetLibrary } from './AssetLibrary';
import { AssetReviewHelp } from './AssetReviewHelp';
import { CharacterDialog } from './CharacterDialog';
import { CharacterGroupBrowser } from './CharacterGroupBrowser';
import { DeleteCharacterGroupDialog } from './DeleteCharacterGroupDialog';
import { PortraitVerificationDialog } from './PortraitVerificationDialog';
import { VerifiedPersonCard } from './VerifiedPersonCard';
import { buildAssetList, selectablePortraitSourceAssets } from './asset-list';
import { applyAssetNameAlias, assetNameAliasKey, readAssetNameAliases, writeAssetNameAliases } from './asset-name-aliases';
import styles from './index.module.scss';
import type { AssetsPanelProps } from './types';
import {
    defaultCharacterName,
    existingVerifiedPhoto,
    portraitCollections,
    portraitGroupLabel,
    shortAssetId,
    verifiedPhotosFor
} from './utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AssetIdIntake } from '@/features/assets/components/AssetIdIntake';
import { ProviderErrorNotice } from '@/features/assets/components/ProviderErrorNotice';
import { checkAssetDeletionPermission, useAssetDeletionProtection } from '@/features/assets/hooks/use-asset-deletion-protection';
import { useDeleteVerifiedPerson } from '@/features/assets/hooks/use-delete-verified-person';
import { usePortraitStatusCheck } from '@/features/assets/hooks/use-portrait-status-check';
import { usePortraitVerificationResult } from '@/features/assets/hooks/use-portrait-verification-result';
import { useProcessingPortraitRefresh } from '@/features/assets/hooks/use-processing-portrait-refresh';
import { useProviderAssetList } from '@/features/assets/hooks/use-provider-asset-list';
import { useVerifiedPeople } from '@/features/assets/hooks/use-verified-people';
import { useVerifiedPhotoUpload } from '@/features/assets/hooks/use-verified-photo-upload';
import { validateAssetImage } from '@/features/assets/image/validation';
import type { PortraitGroup, PortraitGroupType } from '@/features/assets/portrait/api';
import { groupVerifiedPhoto, groupedVerifiedPhotos } from '@/features/assets/portrait/group-verified-photo';
import {
    clearPortraitVerificationResult,
    type PortraitVerificationResult
} from '@/features/assets/portrait/setup-flow';
import { createAndTrackPortraitAsset } from '@/features/assets/portrait/track';
import { assetIdFromReferenceUrl, refKey } from '@/features/assets/reference/origin';
import { characterPreviewUrl } from '@/features/generation/history/characters';
import type { UserAsset } from '@/lib/media-archive';
import { Loader2, RefreshCw, ShieldCheck, Sparkles, Trash2, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export function AssetsPanel({
    loadAssets,
    uploadImage,
    deleteAsset,
    checkDeletionProtection,
    characters,
    addCharacter,
    removeCharacter,
    portraitEnabled,
    portraits,
    deletedIds,
    declarations,
    addPortrait,
    syncPortraitState,
    removePortrait,
    startPortraitSession,
    loadPortraitGroups,
    loadPortraitAssets,
    createPortraitGroup,
    deletePortraitGroup,
    createPortraitAsset,
    getPortraitAsset,
    getPortraitStatus,
    reviewAsset,
    pendingPortraitSetup,
    onPortraitSetupComplete,
    onUseAsReference,
    onUseAsReferenceVideo,
    onAttachAssetId,
    onOpenVideo,
    onSyncProjectAssetStatuses,
    onAddVerifiedToProject,
    onArchiveVerifiedAssets,
    active
}: AssetsPanelProps) {
    const t = useTranslations();
    const deletionStatus = useAssetDeletionProtection(active, checkDeletionProtection);
    const protectedDeletionMessage = t('This account<apos>s assets are protected and cannot be deleted');
    const unavailableDeletionMessage = t('Could not verify asset deletion permission<dot> Please retry');
    const loadAssetsError = t('Could not load assets');
    const loadPortraitGroupsError = t('Could not load portrait groups');
    const assetsSignInError = t('Sign in at xcity<dot>ai to view your assets');
    const characterFallback = t('Character');
    const unknownError = t('Unknown error');
    const invalidReferenceImageError = t(
        'Studio could not use the reference image<dot> Please check the image size<comma> format<comma> and content<comma> then try again'
    );
    const unknownImageValidationNotice = t('Studio will validate this image after submission');
    const virtualCharacterAddedNotice = t('Virtual character image added');
    const verifiedPhotoAddedNotice = t('Verified photo added');
    const duplicatePhotoNotice = t('This photo is already in the verified person');
    const portraitImageError = t('Could not add portrait image');
    const verificationCompleteNotice = t('Verification complete<dot> You can now upload photos of this person');
    const assetCharacterName = React.useCallback(
        (asset: UserAsset) => defaultCharacterName(asset, characterFallback),
        [characterFallback]
    );
    const [assets, setAssets] = React.useState<UserAsset[] | null>(null);
    const [assetNameAliases, setAssetNameAliases] = React.useState<Record<string, string>>(() =>
        readAssetNameAliases()
    );
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [characterAsset, setCharacterAsset] = React.useState<UserAsset | null>(null);
    const [characterReferenceUrl, setCharacterReferenceUrl] = React.useState('');
    const [characterName, setCharacterName] = React.useState('');
    const [portraitGroups, setPortraitGroups] = React.useState<PortraitGroup[] | null>(null);
    const { profiles: verifiedPeople, save: saveVerifiedPerson, remove: removeVerifiedPerson } = useVerifiedPeople();
    const [isLoadingPortraitGroups, setIsLoadingPortraitGroups] = React.useState(false);
    const [isStartingPortraitSession, setIsStartingPortraitSession] = React.useState(false);
    const [isPortraitVerificationOpen, setIsPortraitVerificationOpen] = React.useState(false);
    const [isCreatingVirtualGroup, setIsCreatingVirtualGroup] = React.useState(false);
    const [deletingPortraitGroupId, setDeletingPortraitGroupId] = React.useState<string | null>(null);
    const [deletingVerifiedGroupId, setDeletingVerifiedGroupId] = React.useState<string | null>(null);
    const [pendingDeleteGroup, setPendingDeleteGroup] = React.useState<PortraitGroup | null>(null);
    const [virtualCharacterName, setVirtualCharacterName] = React.useState('');
    const [portraitError, setPortraitError] = React.useState<string | null>(null);
    const [portraitNotice, setPortraitNotice] = React.useState<string | null>(null);
    const [characterGroupError, setCharacterGroupError] = React.useState<string | null>(null);
    const [characterGroupNotice, setCharacterGroupNotice] = React.useState<string | null>(null);
    const [addingPortraitGroupId, setAddingPortraitGroupId] = React.useState<string | null>(null);
    const [portraitDrafts, setPortraitDrafts] = React.useState<Record<string, { assetKey: string; name: string }>>({});
    const [portraitStatus, setPortraitStatus] = React.useState<string | null>(null);
    const [verifiedSetupGroupId, setVerifiedSetupGroupId] = React.useState<string | null>(null);
    const [automaticSetupRetry, setAutomaticSetupRetry] = React.useState(0);
    const [isCheckingPortraitSetup, setIsCheckingPortraitSetup] = React.useState(false);
    const automaticSetupAttemptRef = React.useRef('');
    const receivedVerificationRef = React.useRef<number | null>(null);
    const errorMessage = React.useCallback(
        (value: unknown) => (value instanceof Error && value.message ? value.message : unknownError),
        [unknownError]
    );

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
                          error: status.error || unknownError
                      })
            );
        } catch (err) {
            setPortraitStatus(
                t('Setup check failed<colon> <lcur>error<rcur>', {
                    error: errorMessage(err)
                })
            );
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

    const refreshPortraitGroups = React.useCallback(async () => {
        if (!portraitEnabled) return;
        setIsLoadingPortraitGroups(true);
        setPortraitError(null);
        try {
            setPortraitGroups(await loadPortraitGroups('all'));
        } catch (err) {
            setPortraitError(errorMessage(err) || loadPortraitGroupsError);
        } finally {
            setIsLoadingPortraitGroups(false);
        }
    }, [errorMessage, loadPortraitGroups, loadPortraitGroupsError, portraitEnabled]);

    const {
        assets: providerAssets,
        error: providerAssetsError,
        hasLoaded: hasLoadedProviderAssets,
        isLoading: isLoadingProviderAssets,
        refresh: refreshProviderAssets,
        upsertAsset: upsertProviderAsset
    } = useProviderAssetList({ active, enabled: portraitEnabled, loadAssets: loadPortraitAssets });
    const { checkStatus: checkPortraitStatus, checkingAssetId } = usePortraitStatusCheck({
        getAsset: getPortraitAsset,
        refreshProviderAssets,
        savePortrait: addPortrait,
        syncState: syncPortraitState
    });

    const handleCheckReviewStatus = async (portrait: (typeof portraits)[number]) => {
        setPortraitError(null);
        setPortraitNotice(null);
        try {
            const status = await checkPortraitStatus(portrait);
            setPortraitNotice(
                status === 'Active' ? t('Reviewed') : status === 'Failed' ? t('Review failed') : t('Under review')
            );
        } catch (error) {
            setPortraitError(
                t('Could not check review status<colon> <lcur>error<rcur>', { error: errorMessage(error) })
            );
        }
    };

    // First fetch happens when the tab first becomes visible.
    const fetchedRef = React.useRef(false);
    React.useEffect(() => {
        if (active && !fetchedRef.current) {
            fetchedRef.current = true;
            void refresh();
        }
    }, [active, refresh]);

    const fetchedPortraitGroupsRef = React.useRef(false);
    React.useEffect(() => {
        if (active && portraitEnabled && !fetchedPortraitGroupsRef.current) {
            fetchedPortraitGroupsRef.current = true;
            void refreshPortraitGroups();
        }
    }, [active, portraitEnabled, refreshPortraitGroups]);

    const receiveVerification = React.useCallback(
        (result: PortraitVerificationResult) => {
            if (receivedVerificationRef.current === result.completedAt) return;
            if (pendingPortraitSetup && result.completedAt < pendingPortraitSetup.requestedAt) return;
            receivedVerificationRef.current = result.completedAt;
            setVerifiedSetupGroupId(result.groupId);
            setIsPortraitVerificationOpen(false);
            setPortraitNotice(verificationCompleteNotice);
            void Promise.all([refreshPortraitGroups(), refreshProviderAssets()]);
            if (!pendingPortraitSetup) clearPortraitVerificationResult();
        },
        [pendingPortraitSetup, refreshPortraitGroups, refreshProviderAssets, verificationCompleteNotice]
    );
    usePortraitVerificationResult(active && portraitEnabled, receiveVerification);

    const deletedIdSet = React.useMemo(() => new Set(deletedIds), [deletedIds]);
    const visibleProviderAssets = React.useMemo(
        () =>
            providerAssets.filter(
                (asset) =>
                    !deletedIdSet.has(asset.assetId) &&
                    (!asset.previewUrl || !deletedIdSet.has(refKey(asset.previewUrl)))
            ),
        [deletedIdSet, providerAssets]
    );
    React.useEffect(() => {
        if (!onSyncProjectAssetStatuses || visibleProviderAssets.length === 0) return;
        onSyncProjectAssetStatuses(
            Object.fromEntries(
                visibleProviderAssets.map((asset) => [
                    asset.assetId,
                    asset.status === 'Active' ? 'active' : asset.status === 'Failed' ? 'failed' : 'reviewing'
                ])
            )
        );
    }, [onSyncProjectAssetStatuses, visibleProviderAssets]);
    const aliasedAssets = React.useMemo(
        () => assets?.map((asset) => applyAssetNameAlias(asset, assetNameAliases)) ?? null,
        [assetNameAliases, assets]
    );
    const assetList = React.useMemo(
        () =>
            buildAssetList(aliasedAssets ?? [], portraits, declarations, providerAssets, deletedIds).map((item) => ({
                ...item,
                asset: applyAssetNameAlias(item.asset, assetNameAliases)
            })),
        [aliasedAssets, assetNameAliases, declarations, deletedIds, portraits, providerAssets]
    );
    const selectableImageAssets = React.useMemo(() => selectablePortraitSourceAssets(assetList), [assetList]);
    const handleDelete = async (item: (typeof assetList)[number]) => {
        const permission = await checkAssetDeletionPermission(checkDeletionProtection);
        if (permission !== 'allowed') {
            setError(permission === 'protected' ? protectedDeletionMessage : unavailableDeletionMessage);
            return;
        }
        const { asset } = item;
        const isProviderOnly = item.source === 'provider';
        const confirmMessage = isProviderOnly
            ? t('Remove this reviewed asset from this workspace<q> It can be added again later')
            : t('Delete this <lcur>kind<rcur> from cloud storage<q> Its links will stop working', {
                  kind: asset.kind
              });
        if (!confirm(confirmMessage)) return;
        try {
            if (!isProviderOnly) await deleteAsset(asset.key);
            const assetId = item.providerAsset?.assetId ?? item.portrait?.assetId;
            if (assetId) removePortrait(assetId);
            removePortrait(asset.key);
            removePortrait(refKey(asset.url));
            if (!isProviderOnly) setAssets((prev) => prev?.filter((a) => a.key !== asset.key) ?? prev);
        } catch {
            setError(t('Delete failed'));
        }
    };

    const openCharacterDialog = (asset: UserAsset, referenceUrl = asset.url) => {
        setCharacterAsset(asset);
        setCharacterReferenceUrl(referenceUrl);
        setCharacterName(assetCharacterName(asset));
    };

    const handleCharacterDialogOpenChange = (open: boolean) => {
        if (open) return;
        setCharacterAsset(null);
        setCharacterReferenceUrl('');
        setCharacterName('');
    };

    const handleSaveCharacter = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!characterAsset) return;
        const name = characterName.trim();
        if (!name) return;
        const referenceUrl = characterReferenceUrl || characterAsset.url;
        const referenceKey = refKey(referenceUrl);
        const existingCharacter = characters.find(
            (character) =>
                refKey(character.url) === referenceKey ||
                Boolean(character.previewUrl && refKey(character.previewUrl) === refKey(characterAsset.url))
        );
        const aliasKey = assetNameAliasKey(characterAsset);
        setAssetNameAliases((prev) => {
            const next = { ...prev, [aliasKey]: name };
            writeAssetNameAliases(next);
            return next;
        });
        setAssets(
            (prev) => prev?.map((asset) => (assetNameAliasKey(asset) === aliasKey ? { ...asset, name } : asset)) ?? prev
        );
        addCharacter({
            id: existingCharacter?.id ?? `asset-character:${referenceKey || aliasKey}`,
            name,
            url: referenceUrl,
            previewUrl: characterAsset.url
        });
        handleCharacterDialogOpenChange(false);
    };

    const { livenessGroups, virtualGroups } = React.useMemo(
        () => portraitCollections(assets, portraitGroups, portraits, declarations),
        [assets, declarations, portraitGroups, portraits]
    );
    const verifiedPhotos = React.useMemo(
        () => verifiedPhotosFor(portraits, visibleProviderAssets),
        [portraits, visibleProviderAssets]
    );
    const groupedPhotos = React.useMemo(
        () => groupedVerifiedPhotos(verifiedPhotos, verifiedPeople),
        [verifiedPhotos, verifiedPeople]
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
        const width = Math.min(960, window.screen.availWidth);
        const height = Math.min(900, window.screen.availHeight);
        const popup = window.open('about:blank', '_blank', `popup=yes,width=${width},height=${height}`);
        if (!popup) {
            setPortraitError(t('Allow pop<dash>ups for this site and try again'));
            return;
        }
        popup.opener = null;
        setIsStartingPortraitSession(true);
        setPortraitError(null);
        setPortraitNotice(null);
        setIsPortraitVerificationOpen(false);
        try {
            clearPortraitVerificationResult();
            setVerifiedSetupGroupId(null);
            const session = await startPortraitSession(window.location.origin);
            if (popup.closed) throw new Error(t('Verification window was closed<dot> Try again'));
            popup.location.replace(session.h5Link);
            setIsPortraitVerificationOpen(true);
            setPortraitNotice(t('Complete verification in the new window<comma> then return here'));
        } catch (err) {
            popup.close();
            setPortraitError(
                t('Could not start verification<colon> <lcur>error<rcur>', {
                    error: errorMessage(err)
                })
            );
        } finally {
            setIsStartingPortraitSession(false);
        }
    };

    const handleCreateVirtualGroup = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = virtualCharacterName.trim();
        if (!name) return;

        setIsCreatingVirtualGroup(true);
        setCharacterGroupError(null);
        setCharacterGroupNotice(null);
        try {
            const result = await createPortraitGroup(name);
            setVirtualCharacterName('');
            setCharacterGroupNotice(
                result.created
                    ? t('Character group <lcur>name<rcur> created', { name: result.slug })
                    : t('Using existing character group <lcur>name<rcur>', { name: result.slug })
            );
            await refreshPortraitGroups();
        } catch (err) {
            setCharacterGroupError(errorMessage(err) || t('Could not create character group'));
        } finally {
            setIsCreatingVirtualGroup(false);
        }
    };

    const saveVerifiedPhotoToGroup = async (
        photo: (typeof verifiedPhotos)[number],
        groupId: string | null,
        newGroupName: string
    ) => {
        const result = await groupVerifiedPhoto({
            photo,
            groupId,
            newGroupName,
            groups: virtualGroups,
            profile: verifiedPeople[photo.groupId],
            createGroup: createPortraitGroup,
            saveProfile: saveVerifiedPerson,
            addToProject: onAddVerifiedToProject
        });
        if (result.created)
            setPortraitGroups((current) =>
                current?.some((group) => group.id === result.group.id) ? current : [...(current ?? []), result.group]
            );
        setPortraitNotice(t('Photo saved to character group'));
        if (result.created) void refreshPortraitGroups();
    };

    const removeVirtualGroupLocally = (groupId: string) => {
        const deletedAssetIds = new Set([
            ...portraits.filter((portrait) => portrait.groupId === groupId).map((portrait) => portrait.assetId),
            ...visibleProviderAssets.filter((asset) => asset.groupId === groupId).map((asset) => asset.assetId)
        ]);
        deletedAssetIds.forEach(removePortrait);
        characters.forEach((character) => {
            const assetId = assetIdFromReferenceUrl(character.url);
            if (assetId && deletedAssetIds.has(assetId)) removeCharacter(character.id);
        });
        setPortraitGroups((current) => current?.filter((item) => item.id !== groupId) ?? current);
        setPortraitDrafts((current) => {
            const next = { ...current };
            delete next[groupId];
            return next;
        });
    };

    const handleDeleteVirtualGroup = async (group: PortraitGroup) => {
        if (!hasLoadedProviderAssets || isLoadingProviderAssets || providerAssetsError) {
            setCharacterGroupError(t('Asset inventory unavailable<semi> refresh before deleting this group'));
            setPendingDeleteGroup(null);
            return;
        }
        if (
            visibleProviderAssets.some((asset) => asset.groupId === group.id) ||
            groupedPhotos.some((photo) => photo.groupId === group.id)
        ) {
            setCharacterGroupError(t('Only empty character groups can be deleted'));
            setPendingDeleteGroup(null);
            return;
        }
        setDeletingPortraitGroupId(group.id);
        setCharacterGroupError(null);
        setCharacterGroupNotice(null);
        try {
            await deletePortraitGroup(group.id);
            removeVirtualGroupLocally(group.id);
            await refreshProviderAssets();
            setCharacterGroupNotice(t('Character group deleted'));
            setPendingDeleteGroup(null);
        } catch (error) {
            try {
                const latestGroups = await loadPortraitGroups('all');
                setPortraitGroups(latestGroups);
                if (!latestGroups.some((item) => item.id === group.id)) {
                    removeVirtualGroupLocally(group.id);
                    await refreshProviderAssets();
                    setCharacterGroupNotice(t('Character group deleted'));
                    setPendingDeleteGroup(null);
                    return;
                }
            } catch {
                // Keep the original deletion error when the authoritative list cannot be refreshed.
            }
            setCharacterGroupError(
                t('Could not delete character group<colon> <lcur>error<rcur>', { error: errorMessage(error) })
            );
        } finally {
            setDeletingPortraitGroupId(null);
        }
    };

    const submitPortraitAsset = React.useCallback(
        async (groupId: string, groupType: PortraitGroupType, sourceUrl: string, name: string) => {
            const setOperationError = groupType === 'AIGC' ? setCharacterGroupError : setPortraitError;
            const setOperationNotice = groupType === 'AIGC' ? setCharacterGroupNotice : setPortraitNotice;
            setAddingPortraitGroupId(groupId);
            setOperationError(null);
            setOperationNotice(null);
            try {
                const duplicate =
                    groupType === 'LivenessFace' && existingVerifiedPhoto(verifiedPhotos, groupId, sourceUrl);
                if (duplicate) {
                    setOperationNotice(duplicatePhotoNotice);
                    return {
                        assetId: duplicate.assetId,
                        groupId,
                        status: duplicate.status,
                        previewUrl: duplicate.thumbUrl,
                        failureReason: ''
                    };
                }
                const validation = await validateAssetImage(sourceUrl);
                if (validation.status === 'rejected') {
                    throw new Error(invalidReferenceImageError);
                }
                if (validation.status === 'unknown') {
                    setOperationNotice(unknownImageValidationNotice);
                }

                const providerAsset = await createAndTrackPortraitAsset(
                    {
                        groupId,
                        groupType,
                        referenceOrigin: groupType === 'AIGC' ? 'thirdparty-ai' : 'real-person',
                        name,
                        thumbUrl: sourceUrl
                    },
                    () => createPortraitAsset({ groupId, url: sourceUrl, name, assetType: 'Image' }),
                    getPortraitAsset,
                    addPortrait,
                    syncPortraitState
                );
                const updatedAt = new Date().toISOString();
                upsertProviderAsset({
                    ...providerAsset,
                    groupType,
                    name,
                    assetType: 'Image',
                    createdAt: updatedAt,
                    updatedAt
                });
                setOperationNotice(groupType === 'AIGC' ? virtualCharacterAddedNotice : verifiedPhotoAddedNotice);
                setPortraitDrafts((prev) => ({
                    ...prev,
                    [groupId]: { assetKey: '', name: '' }
                }));
                void refreshProviderAssets();
                return providerAsset;
            } catch {
                setOperationNotice(null);
                setOperationError(portraitImageError);
                return null;
            } finally {
                setAddingPortraitGroupId(null);
            }
        },
        [
            addPortrait,
            createPortraitAsset,
            getPortraitAsset,
            invalidReferenceImageError,
            portraitImageError,
            refreshProviderAssets,
            syncPortraitState,
            unknownImageValidationNotice,
            upsertProviderAsset,
            verifiedPhotoAddedNotice,
            virtualCharacterAddedNotice,
            verifiedPhotos,
            duplicatePhotoNotice
        ]
    );

    const handleAddPortraitAsset = async (groupId: string, groupType: PortraitGroupType) => {
        const draft = portraitDrafts[groupId];
        const selected = selectableImageAssets.find((asset) => asset.key === draft?.assetKey);
        if (!selected) {
            (groupType === 'AIGC' ? setCharacterGroupError : setPortraitError)(t('Choose an image asset first'));
            return;
        }
        const providerAsset = await submitPortraitAsset(
            groupId,
            groupType,
            selected.url,
            draft?.name.trim() || assetCharacterName(selected)
        );
        if (
            providerAsset?.status === 'Active' &&
            groupType === 'LivenessFace' &&
            pendingPortraitSetup &&
            refKey(selected.url) === pendingPortraitSetup.referenceKey
        ) {
            clearPortraitVerificationResult();
            onPortraitSetupComplete?.({ ...pendingPortraitSetup, assetId: providerAsset.assetId, groupId });
        }
    };
    const { upload: handleUploadPortraitPhoto, uploadingGroupId } = useVerifiedPhotoUpload({
        uploadImage,
        profiles: verifiedPeople,
        photos: verifiedPhotos,
        saveProfile: saveVerifiedPerson,
        submit: submitPortraitAsset,
        refresh,
        setError: setPortraitError,
        setNotice: setPortraitNotice
    });

    const handleDeleteVerifiedPerson = useDeleteVerifiedPerson({
        photos: verifiedPhotos,
        profiles: verifiedPeople,
        deleteGroup: deletePortraitGroup,
        removePortrait,
        archiveAssets: onArchiveVerifiedAssets,
        removeProfile: removeVerifiedPerson,
        onDeleted: (groupId) => {
            if (verifiedSetupGroupId === groupId) {
                setVerifiedSetupGroupId(null);
                clearPortraitVerificationResult();
            }
        },
        refreshAssets: refreshProviderAssets,
        setGroups: setPortraitGroups,
        setDeletingId: setDeletingVerifiedGroupId,
        setError: setPortraitError,
        setNotice: setPortraitNotice
    });

    React.useEffect(() => {
        if (!pendingPortraitSetup || !verifiedSetupGroupId || addingPortraitGroupId) return;
        const attemptKey = `${pendingPortraitSetup.referenceKey}:${verifiedSetupGroupId}`;
        if (automaticSetupAttemptRef.current === attemptKey) return;
        automaticSetupAttemptRef.current = attemptKey;
        const matchingAsset = selectableImageAssets.find(
            (asset) => refKey(asset.url) === pendingPortraitSetup.referenceKey
        );
        const name = matchingAsset ? assetCharacterName(matchingAsset) : characterFallback;
        void submitPortraitAsset(verifiedSetupGroupId, 'LivenessFace', pendingPortraitSetup.sourceUrl, name).then(
            (providerAsset) => {
                if (providerAsset?.status !== 'Active') {
                    return;
                }
                clearPortraitVerificationResult();
                onPortraitSetupComplete?.({
                    ...pendingPortraitSetup,
                    assetId: providerAsset.assetId,
                    groupId: verifiedSetupGroupId
                });
            }
        );
    }, [
        addingPortraitGroupId,
        assetCharacterName,
        automaticSetupRetry,
        characterFallback,
        onPortraitSetupComplete,
        pendingPortraitSetup,
        selectableImageAssets,
        submitPortraitAsset,
        verifiedSetupGroupId
    ]);

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
                <div className={styles.headerActions}>
                    <AssetReviewHelp />
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => void Promise.all([refresh(), refreshProviderAssets()])}
                        disabled={isLoading || isLoadingProviderAssets}
                        className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                        <RefreshCw
                            size={14}
                            className={isLoading || isLoadingProviderAssets ? 'animate-spin' : undefined}
                        />
                        <span className='ml-1'>{t('Refresh')}</span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className='flex-grow overflow-y-auto p-4'>
                {(deletionStatus === 'protected' || deletionStatus === 'unavailable') && (
                    <p className='mb-3 text-sm text-amber-300'>{deletionStatus === 'protected' ? protectedDeletionMessage : unavailableDeletionMessage}</p>
                )}
                {error && <p className='mb-3 text-sm text-red-400'>{error}</p>}
                {providerAssetsError && <ProviderErrorNotice error={providerAssetsError} />}
                {characters.length > 0 && (
                    <div className='mb-4 space-y-2 border-b border-white/10 pb-4'>
                        <h3 className='text-xs font-medium text-white/50'>{t('Saved character shortcuts')}</h3>
                        <div className='flex gap-2 overflow-x-auto pb-1'>
                            {characters.map((character) => {
                                const previewUrl = characterPreviewUrl(character, portraits);
                                return (
                                    <div
                                        key={character.id}
                                        className='flex shrink-0 items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1.5'>
                                        <div className='flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-white/15 bg-white/5'>
                                            {previewUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element -- worker-hosted URL
                                                <img
                                                    src={previewUrl}
                                                    alt={character.name}
                                                    loading='lazy'
                                                    className='h-full w-full object-cover'
                                                />
                                            ) : (
                                                <UserRound className='h-4 w-4 text-white/40' aria-hidden='true' />
                                            )}
                                        </div>
                                        <span className='max-w-32 truncate text-xs text-white/80'>
                                            {character.name}
                                        </span>
                                        <button
                                            type='button'
                                            title={t('Remove character')}
                                            aria-label={t('Remove character <lcur>name<rcur>', {
                                                name: character.name
                                            })}
                                            onClick={() => removeCharacter(character.id)}
                                            className='rounded p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white'>
                                            <Trash2 className='h-3 w-3' />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
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

                        {pendingPortraitSetup && (
                            <div className={styles.portraitSetup}>
                                <span className={styles.portraitSetupPreview}>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- user-selected reference URL */}
                                    <img
                                        src={pendingPortraitSetup.sourceUrl}
                                        alt={t('Pending real<dash>person image')}
                                    />
                                </span>
                                <p className={styles.portraitSetupMessage}>
                                    {t(
                                        'Complete face verification<comma> then Studio will review and bind this image automatically'
                                    )}
                                </p>
                                {verifiedSetupGroupId && portraitError && (
                                    <button
                                        type='button'
                                        disabled={Boolean(addingPortraitGroupId)}
                                        onClick={() => {
                                            automaticSetupAttemptRef.current = '';
                                            setAutomaticSetupRetry((value) => value + 1);
                                        }}
                                        className={styles.portraitSetupRetry}>
                                        {t('Retry')}
                                    </button>
                                )}
                            </div>
                        )}

                        {portraitNotice && <p className='text-xs text-emerald-300'>{portraitNotice}</p>}
                        {portraitStatus && <p className='text-xs text-white/50'>{portraitStatus}</p>}
                        {portraitError && portraitError !== providerAssetsError && (
                            <ProviderErrorNotice error={portraitError} />
                        )}

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
                                        <VerifiedPersonCard
                                            key={group.id}
                                            group={group}
                                            profile={verifiedPeople[group.id] ?? { name: '' }}
                                            photos={verifiedPhotos.filter((photo) => photo.groupId === group.id)}
                                            sourceAssets={selectableImageAssets}
                                            characterGroups={virtualGroups}
                                            draft={draft}
                                            busy={isAdding || uploadingGroupId === group.id}
                                            deleting={deletingVerifiedGroupId === group.id}
                                            newlyVerified={verifiedSetupGroupId === group.id}
                                            canUpload={Boolean(uploadImage)}
                                            deletionAllowed={deletionStatus === 'allowed'}
                                            onProfileChange={(patch) => saveVerifiedPerson(group.id, patch)}
                                            onCoverUpload={async (file) => {
                                                if (!uploadImage) throw new Error('Upload unavailable');
                                                saveVerifiedPerson(group.id, { coverUrl: await uploadImage(file) });
                                            }}
                                            onDraftChange={(patch) => updatePortraitDraft(group.id, patch)}
                                            onAddPhoto={() => void handleAddPortraitAsset(group.id, 'LivenessFace')}
                                            onUploadPhoto={(file) => handleUploadPortraitPhoto(group.id, file)}
                                            onDelete={() => void handleDeleteVerifiedPerson(group)}
                                            onSaveToGroup={saveVerifiedPhotoToGroup}
                                            onOpenVideo={() => onOpenVideo?.()}
                                        />
                                    );
                                })}
                            </div>
                        ) : (
                            <p className='text-xs text-white/40'>
                                {t('No verified groups yet<dot> Complete verification<comma> then refresh')}
                            </p>
                        )}

                        <div className='space-y-3 border-t border-white/10 pt-4'>
                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                <div className='min-w-0 flex-1'>
                                    <h3 className='text-xs font-medium text-white/50'>
                                        {t('My Xcity character groups')}
                                    </h3>
                                    <p className='mt-1 text-xs text-white/40'>
                                        {t(
                                            'Organize reviewed character images and verified person photos in one place'
                                        )}
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
                                        {t('Create character group')}
                                    </Button>
                                </form>
                            </div>

                            {characterGroupNotice && <p className='text-xs text-emerald-300'>{characterGroupNotice}</p>}
                            {characterGroupError && !pendingDeleteGroup && (
                                <p className='text-xs text-red-400' role='alert'>
                                    {characterGroupError}
                                </p>
                            )}

                            {isLoadingPortraitGroups && portraitGroups === null ? (
                                <div className='flex items-center gap-2 text-xs text-white/40'>
                                    <Loader2 className='h-3 w-3 animate-spin' />
                                    {t('Loading character groups')}
                                </div>
                            ) : portraitGroups && virtualGroups.length > 0 ? (
                                <CharacterGroupBrowser
                                    groups={virtualGroups}
                                    assets={visibleProviderAssets}
                                    verifiedPhotos={groupedPhotos}
                                    sourceAssets={selectableImageAssets}
                                    drafts={portraitDrafts}
                                    addingGroupId={addingPortraitGroupId}
                                    deletingGroupId={deletingPortraitGroupId}
                                    assetInventoryReady={
                                        hasLoadedProviderAssets &&
                                        !isLoadingProviderAssets &&
                                        providerAssetsError === null
                                    }
                                    deletionAllowed={deletionStatus === 'allowed'}
                                    groupLabel={(group) =>
                                        portraitGroupLabel(
                                            group,
                                            t('Group <lcur>id<rcur>', { id: shortAssetId(group.id) })
                                        )
                                    }
                                    sourceLabel={(asset) => asset.name || assetCharacterName(asset)}
                                    onAdd={(groupId) => handleAddPortraitAsset(groupId, 'AIGC')}
                                    onDelete={(group) => {
                                        setCharacterGroupError(null);
                                        setCharacterGroupNotice(null);
                                        setPendingDeleteGroup(group);
                                    }}
                                    onDraftChange={updatePortraitDraft}
                                />
                            ) : (
                                <p className='text-xs text-white/40'>
                                    {t('No character groups yet<dot> Create one<comma> then add uploaded images')}
                                </p>
                            )}

                            <DeleteCharacterGroupDialog
                                error={characterGroupError}
                                groupName={
                                    pendingDeleteGroup
                                        ? portraitGroupLabel(pendingDeleteGroup, shortAssetId(pendingDeleteGroup.id))
                                        : null
                                }
                                isDeleting={Boolean(
                                    pendingDeleteGroup && deletingPortraitGroupId === pendingDeleteGroup.id
                                )}
                                onCancel={() => {
                                    setPendingDeleteGroup(null);
                                    setCharacterGroupError(null);
                                }}
                                onConfirm={() => {
                                    if (pendingDeleteGroup) void handleDeleteVirtualGroup(pendingDeleteGroup);
                                }}
                            />
                        </div>
                    </div>
                )}

                <AssetLibrary
                    deletionAllowed={deletionStatus === 'allowed'}
                    checkingAssetId={checkingAssetId}
                    items={assetList}
                    providerAssets={visibleProviderAssets}
                    isLoading={isLoading || isLoadingProviderAssets}
                    onCheckReviewStatus={handleCheckReviewStatus}
                    onDelete={handleDelete}
                    onReview={reviewAsset}
                    onSaveCharacter={openCharacterDialog}
                    onUseImage={onUseAsReference}
                    onUseVideo={onUseAsReferenceVideo}
                />
                <AssetIdIntake onAttachAssetId={onAttachAssetId} />

                {/* Legacy internal authorization UI is intentionally disabled; provider review happens inline. */}
                {/*
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

                    <form onSubmit={(event) => void handleSubmitAuthorization(event)} className='max-w-5xl space-y-4'>
                        <div className='flex items-start gap-2'>
                            <ShieldCheck className={styles.authorizationIcon} />
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
                                    <div className={styles.authorizationEmpty}>
                                        <p className={styles.authorizationEmptyText}>
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
                                                className={styles.authorizationEmptyAction}>
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
                */}
            </CardContent>
            <PortraitVerificationDialog
                open={isPortraitVerificationOpen}
                error={portraitError}
                onClose={() => setIsPortraitVerificationOpen(false)}
                onRestartInNewWindow={() => void handleStartPortraitSession()}
            />
        </Card>
    );
}
