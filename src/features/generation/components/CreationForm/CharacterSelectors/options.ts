import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import type { VideoPortrait } from '@/features/generation/history/merge';

function isAttached(portrait: VideoPortrait, referenceUrls: string[]): boolean {
    return referenceUrls.includes(portraitReferenceUrl(portrait.assetId));
}

/** One virtual-character choice represents one provider asset group. */
export function virtualCharacterOptions(portraits: VideoPortrait[], referenceUrls: string[]): VideoPortrait[] {
    const byGroup = new Map<string, VideoPortrait>();

    for (const portrait of portraits) {
        if (portrait.status !== 'Active' || portrait.groupType !== 'AIGC' || portrait.referenceOrigin === 'no-person') {
            continue;
        }

        const groupKey = portrait.groupId || portrait.assetId;
        const existing = byGroup.get(groupKey);
        if (!existing) {
            byGroup.set(groupKey, portrait);
            continue;
        }

        const portraitAttached = isAttached(portrait, referenceUrls);
        const existingAttached = isAttached(existing, referenceUrls);
        if (
            (portraitAttached && !existingAttached) ||
            (portraitAttached === existingAttached && portrait.updatedAt > existing.updatedAt)
        ) {
            byGroup.set(groupKey, portrait);
        }
    }

    return Array.from(byGroup.values()).sort((left, right) => right.updatedAt - left.updatedAt);
}
