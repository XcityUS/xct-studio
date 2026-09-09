import type { PortraitGroup } from '@/features/assets/portrait/api';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import type { VideoPortrait } from '@/features/generation/history/merge';

export type VirtualCharacterOption = VideoPortrait & {
    displayName?: string;
};

function xcityGroupSlug(group: PortraitGroup): string {
    return group.name.split(':').slice(2).join(':').trim();
}

function isAttached(portrait: VideoPortrait, referenceUrls: string[]): boolean {
    return referenceUrls.includes(portraitReferenceUrl(portrait.assetId));
}

/** One virtual-character choice represents one provider asset group. */
export function virtualCharacterOptions(
    portraits: VideoPortrait[],
    referenceUrls: string[],
    groups?: PortraitGroup[]
): VirtualCharacterOption[] {
    const xcityGroups = groups
        ? new Map(
              groups
                  .filter((group) => group.groupType === 'AIGC')
                  .filter((group) => xcityGroupSlug(group).toLowerCase() !== 'reviewed-materials')
                  .map((group) => [group.id, group] as const)
          )
        : null;
    const byGroup = new Map<string, VirtualCharacterOption>();

    for (const portrait of portraits) {
        if (portrait.status !== 'Active' || portrait.groupType !== 'AIGC' || portrait.referenceOrigin === 'no-person') {
            continue;
        }

        const groupKey = portrait.groupId || portrait.assetId;
        const group = xcityGroups?.get(groupKey);
        if (xcityGroups && !group) continue;
        const existing = byGroup.get(groupKey);
        const option = {
            ...portrait,
            displayName: group ? xcityGroupSlug(group) || portrait.name : portrait.name
        };
        if (!existing) {
            byGroup.set(groupKey, option);
            continue;
        }

        const portraitAttached = isAttached(option, referenceUrls);
        const existingAttached = isAttached(existing, referenceUrls);
        if (
            (portraitAttached && !existingAttached) ||
            (portraitAttached === existingAttached && option.updatedAt > existing.updatedAt)
        ) {
            byGroup.set(groupKey, option);
        }
    }

    return Array.from(byGroup.values()).sort((left, right) => right.updatedAt - left.updatedAt);
}
