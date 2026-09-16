'use client';

import { validateAssetImage } from '@/features/assets/image/validation';
import {
    storedPortraitAssetStatus,
    waitForPortraitAsset,
    type PortraitAsset,
    type PortraitAssetType
} from '@/features/assets/portrait/api';
import { normalizeProviderAssetName } from '@/features/assets/portrait/name';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import { refKey, type InlineReviewOrigin, type ReferenceDeclaration } from '@/features/assets/reference/origin';
import type { VideoPortrait } from '@/features/generation/history/merge';
import * as React from 'react';

export type ProviderAssetReviewInput = {
    url: string;
    name: string;
    groupName?: string;
    origin: InlineReviewOrigin;
    assetType?: PortraitAssetType;
};

export class ReviewImageError extends Error {}

type ProviderAssetReviewOptions = {
    enabled: boolean;
    declarations: Record<string, ReferenceDeclaration>;
    syncCloudNow: () => Promise<void>;
    syncNow: () => Promise<void>;
    findAssetByUrl: (url: string) => VideoPortrait | undefined;
    saveAsset: (asset: VideoPortrait) => void;
    setDeclaration: (key: string, declaration: ReferenceDeclaration) => void;
    createGroup: (name: string) => Promise<{ groupId: string }>;
    createAsset: (input: {
        groupId: string;
        url: string;
        name: string;
        assetType?: PortraitAssetType;
    }) => Promise<{ assetId: string; status: 'Processing' }>;
    getAsset: (assetId: string) => Promise<PortraitAsset>;
};

type ReviewTarget = {
    assetId: string;
    groupId: string;
};

function trackedAsset(
    input: ProviderAssetReviewInput,
    target: ReviewTarget,
    status: VideoPortrait['status'],
    failureReason?: string
): VideoPortrait {
    return {
        ...target,
        groupType: 'AIGC',
        referenceOrigin: input.origin,
        name: input.name,
        thumbUrl: input.url,
        status,
        assetType: input.assetType ?? 'Image',
        ...(failureReason ? { failureReason } : {}),
        updatedAt: Date.now()
    };
}

async function approveTarget(
    options: ProviderAssetReviewOptions,
    input: ProviderAssetReviewInput,
    target: ReviewTarget
): Promise<string> {
    const declaration = {
        ...(options.declarations[refKey(input.url)] ?? {}),
        origin: input.origin,
        declaredAt: Date.now(),
        ...target
    } satisfies ReferenceDeclaration;
    options.setDeclaration(refKey(input.url), declaration);
    options.setDeclaration(refKey(portraitReferenceUrl(target.assetId)), declaration);
    await options.syncNow();
    return portraitReferenceUrl(target.assetId);
}

async function refreshTarget(
    options: ProviderAssetReviewOptions,
    input: ProviderAssetReviewInput,
    existing: VideoPortrait
): Promise<{ target: ReviewTarget; approvedUrl?: string }> {
    const asset = await options.getAsset(existing.assetId);
    const target = { assetId: asset.assetId || existing.assetId, groupId: asset.groupId || existing.groupId };
    const status = storedPortraitAssetStatus(asset.status);
    options.saveAsset(trackedAsset(input, target, status, asset.failureReason));
    await options.syncNow();
    return {
        target,
        ...(status === 'Active' ? { approvedUrl: await approveTarget(options, input, target) } : {})
    };
}

async function createTarget(
    options: ProviderAssetReviewOptions,
    input: ProviderAssetReviewInput,
    existing?: VideoPortrait
): Promise<ReviewTarget> {
    if ((input.assetType ?? 'Image') === 'Image') {
        const validation = await validateAssetImage(input.url);
        if (validation.status === 'rejected') throw new ReviewImageError(validation.message);
    }
    const groupName =
        input.groupName?.trim() ||
        (input.origin === 'no-person' || input.origin === 'uploaded' ? 'Reviewed materials' : input.name);
    const groupId = existing?.groupId || (await options.createGroup(groupName)).groupId;
    const created = await options.createAsset({
        groupId,
        url: input.url,
        name: input.name,
        assetType: input.assetType ?? 'Image'
    });
    const target = { assetId: created.assetId, groupId };
    options.saveAsset(trackedAsset(input, target, created.status));
    options.setDeclaration(refKey(input.url), {
        ...(options.declarations[refKey(input.url)] ?? {}),
        origin: input.origin,
        declaredAt: Date.now(),
        groupId
    });
    await options.syncNow();
    return target;
}

async function waitForApproval(
    options: ProviderAssetReviewOptions,
    input: ProviderAssetReviewInput,
    target: ReviewTarget
): Promise<string> {
    try {
        const asset = await waitForPortraitAsset(target.assetId, options.getAsset);
        const approved = { assetId: asset.assetId || target.assetId, groupId: asset.groupId || target.groupId };
        options.saveAsset(trackedAsset(input, approved, 'Active'));
        return approveTarget(options, input, approved);
    } catch (error) {
        const asset = await options.getAsset(target.assetId).catch(() => null);
        if (asset) {
            const current = { assetId: asset.assetId || target.assetId, groupId: asset.groupId || target.groupId };
            options.saveAsset(
                trackedAsset(input, current, storedPortraitAssetStatus(asset.status), asset.failureReason)
            );
            await options.syncNow();
        }
        throw error;
    }
}

export async function reviewProviderAsset(
    options: ProviderAssetReviewOptions,
    rawInput: ProviderAssetReviewInput
): Promise<string> {
    const input = { ...rawInput, name: normalizeProviderAssetName(rawInput.name) };
    await options.syncCloudNow();

    const existing = options.findAssetByUrl(input.url);
    if (existing && existing.status !== 'Failed') {
        const refreshed = await refreshTarget(options, input, existing);
        if (refreshed.approvedUrl) return refreshed.approvedUrl;
        return waitForApproval(options, input, refreshed.target);
    }

    return waitForApproval(options, input, await createTarget(options, input, existing));
}

export function useProviderAssetReview(options: ProviderAssetReviewOptions) {
    return React.useCallback((input: ProviderAssetReviewInput) => reviewProviderAsset(options, input), [options]);
}
