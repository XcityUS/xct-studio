'use client';

import type { PortraitGroup } from '../portrait/api';
import type { VerifiedPersonProfiles } from '../portrait/people';
import type { VideoPortrait } from '@/features/generation/history/merge';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Options = {
    photos: VideoPortrait[];
    profiles: VerifiedPersonProfiles;
    deleteGroup: (groupId: string) => Promise<void>;
    removePortrait: (assetId: string) => void;
    archiveAssets?: (assetIds: string[]) => void;
    removeProfile: (groupId: string) => void;
    onDeleted?: (groupId: string) => void;
    refreshAssets: () => Promise<void>;
    setGroups: React.Dispatch<React.SetStateAction<PortraitGroup[] | null>>;
    setDeletingId: React.Dispatch<React.SetStateAction<string | null>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    setNotice: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useDeleteVerifiedPerson(options: Options) {
    const t = useTranslations();
    return async (group: PortraitGroup) => {
        const photos = options.photos.filter((photo) => photo.groupId === group.id);
        const name = options.profiles[group.id]?.name || t('Unnamed verified person');
        if (
            !window.confirm(
                t('Delete <lcur>name<rcur> and <lcur>count<rcur> photos<q> This cannot be undone<dot> Project bindings will be archived', {
                    name,
                    count: photos.length
                })
            )
        )
            return;
        options.setDeletingId(group.id);
        options.setError(null);
        try {
            await options.deleteGroup(group.id);
            const ids = photos.map((photo) => photo.assetId);
            ids.forEach(options.removePortrait);
            options.archiveAssets?.(ids);
            options.setGroups((current) => current?.filter((item) => item.id !== group.id) ?? current);
            options.removeProfile(group.id);
            options.onDeleted?.(group.id);
            options.setNotice(t('Verified person deleted'));
            try {
                await options.refreshAssets();
            } catch {
                options.setError(t('Person deleted<comma> but the asset list could not refresh'));
            }
        } catch {
            options.setError(t('Could not delete verified person<dot> Please retry'));
        } finally {
            options.setDeletingId(null);
        }
    };
}
