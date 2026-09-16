'use client';

import { imageFingerprint, type VerifiedPersonProfile, type VerifiedPersonProfiles } from '../portrait/people';
import type { PortraitAsset } from '@/features/assets/portrait/api';
import type { VideoPortrait } from '@/features/generation/history/merge';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Options = {
    uploadImage?: (file: File) => Promise<string>;
    profiles: VerifiedPersonProfiles;
    photos: VideoPortrait[];
    saveProfile: (groupId: string, patch: Partial<VerifiedPersonProfile>) => void;
    submit: (groupId: string, groupType: 'LivenessFace', url: string, name: string) => Promise<PortraitAsset | null>;
    refresh: () => Promise<void>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    setNotice: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useVerifiedPhotoUpload(options: Options) {
    const t = useTranslations();
    const [uploadingGroupId, setUploadingGroupId] = React.useState<string | null>(null);
    const inFlight = React.useRef(new Set<string>());
    const upload = async (groupId: string, file: File) => {
        if (!options.uploadImage || inFlight.current.has(groupId)) return;
        inFlight.current.add(groupId);
        setUploadingGroupId(groupId);
        options.setError(null);
        try {
            const fingerprint = await imageFingerprint(file);
            const existingId = options.profiles[groupId]?.photoHashes?.[fingerprint];
            if (existingId && options.photos.some((photo) => photo.assetId === existingId)) {
                options.setNotice(t('This photo is already in the verified person'));
                return;
            }
            const url = await options.uploadImage(file);
            const name = file.name.replace(/\.[^.]+$/, '').trim() || t('Character');
            const submitted = await options.submit(groupId, 'LivenessFace', url, name);
            if (submitted)
                options.saveProfile(groupId, {
                    photoHashes: {
                        ...options.profiles[groupId]?.photoHashes,
                        [fingerprint]: submitted.assetId
                    }
                });
            await options.refresh();
        } catch (error) {
            options.setError(
                t('Could not upload photo<colon> <lcur>error<rcur>', {
                    error: error instanceof Error ? error.message : t('Unknown error')
                })
            );
        } finally {
            inFlight.current.delete(groupId);
            setUploadingGroupId(null);
        }
    };
    return { upload, uploadingGroupId };
}
