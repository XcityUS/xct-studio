import {
    normalizeAssetId,
    refKey,
    type ReferenceDeclaration,
    type ReferenceOrigin
} from '@/features/assets/reference/origin';
import type { ErrorScope } from '@/features/studio/components/StudioWorkspace/types';
import { DEFAULT_VIDEO_REFERENCE_MODEL, maxReferenceImages, type VideoModel } from '@/shared/config/seedance';
import * as React from 'react';

type AssetIdIntakeOptions = {
    createModel: VideoModel;
    setCreateModel: React.Dispatch<React.SetStateAction<VideoModel>>;
    referenceUrls: string[];
    setReferenceUrls: React.Dispatch<React.SetStateAction<string[]>>;
    declarations: Record<string, ReferenceDeclaration>;
    setDeclaration: (key: string, declaration: ReferenceDeclaration) => void;
    setNotice: React.Dispatch<React.SetStateAction<string | null>>;
    setError: (message: string | null, scope?: ErrorScope) => void;
};

export function useAssetIdIntake(options: AssetIdIntakeOptions) {
    return React.useCallback(
        (input: { assetId: string; origin: ReferenceOrigin }) => {
            const assetId = normalizeAssetId(input.assetId);
            if (!assetId) return false;
            const url = `asset://${assetId}`;
            const targetModel =
                maxReferenceImages(options.createModel) <= 1 ? DEFAULT_VIDEO_REFERENCE_MODEL : options.createModel;
            const referenceLimit = maxReferenceImages(targetModel);
            if (!options.referenceUrls.includes(url) && options.referenceUrls.length >= referenceLimit) {
                options.setError(
                    `Reference image limit reached (${referenceLimit}). Remove one before adding another.`,
                    'create'
                );
                return false;
            }

            if (targetModel !== options.createModel) options.setCreateModel(targetModel);
            options.setReferenceUrls((current) => (current.includes(url) ? current : [...current, url]));
            const key = refKey(url);
            options.setDeclaration(key, {
                ...(options.declarations[key] ?? {}),
                origin: input.origin,
                declaredAt: Date.now(),
                assetId
            });
            options.setNotice('Asset ID attached as a reference image.');
            options.setError(null, 'create');
            return true;
        },
        [options]
    );
}
