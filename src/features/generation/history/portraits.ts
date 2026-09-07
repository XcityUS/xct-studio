import { REFERENCE_ORIGINS, type ReferenceOrigin } from '@/features/assets/reference/origin';
import type { VideoPortrait, VideoPortraitGroupType, VideoPortraitStatus } from '@/features/generation/history/merge';

const REFERENCE_ORIGIN_SET: ReadonlySet<string> = new Set(REFERENCE_ORIGINS);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function groupType(value: unknown): VideoPortraitGroupType {
    return value === 'AIGC' ? 'AIGC' : 'LivenessFace';
}

function status(value: unknown): VideoPortraitStatus {
    if (value === undefined) return 'Active';
    if (value === 'Active' || value === 'Failed') return value;
    return 'Processing';
}

function optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    return value.trim() || undefined;
}

function referenceOrigin(value: unknown): ReferenceOrigin | undefined {
    return typeof value === 'string' && REFERENCE_ORIGIN_SET.has(value) ? (value as ReferenceOrigin) : undefined;
}

export function parsePortraits(value: unknown): VideoPortrait[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!isRecord(item)) return [];

        const assetId = optionalString(item.assetId);
        const groupId = optionalString(item.groupId);
        const name = optionalString(item.name);
        const thumbUrl = optionalString(item.thumbUrl);
        if (!assetId || !groupId || !name || !thumbUrl) return [];

        return [
            {
                assetId,
                groupId,
                groupType: groupType(item.groupType),
                name,
                thumbUrl,
                status: status(item.status),
                ...(referenceOrigin(item.referenceOrigin)
                    ? { referenceOrigin: referenceOrigin(item.referenceOrigin) }
                    : {}),
                ...(optionalString(item.failureReason) ? { failureReason: optionalString(item.failureReason) } : {}),
                updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : 0
            }
        ];
    });
}

export function normalizePortrait(portrait: VideoPortrait): VideoPortrait | null {
    const assetId = portrait.assetId.trim();
    const groupId = portrait.groupId.trim();
    const name = portrait.name.trim();
    const thumbUrl = portrait.thumbUrl.trim();
    if (!assetId || !groupId || !name || !thumbUrl) return null;

    return {
        assetId,
        groupId,
        groupType: groupType(portrait.groupType),
        name,
        thumbUrl,
        status: status(portrait.status),
        ...(referenceOrigin(portrait.referenceOrigin)
            ? { referenceOrigin: referenceOrigin(portrait.referenceOrigin) }
            : {}),
        ...(optionalString(portrait.failureReason) ? { failureReason: optionalString(portrait.failureReason) } : {}),
        updatedAt: Number.isFinite(portrait.updatedAt) ? portrait.updatedAt : Date.now()
    };
}
