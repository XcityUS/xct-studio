import type { PortraitGroup } from './api';
import type { VerifiedPersonProfile, VerifiedPersonProfiles } from './people';
import type { VideoPortrait } from '@/features/generation/history/merge';

type SaveInput = {
    photo: VideoPortrait;
    groupId: string | null;
    newGroupName: string;
    groups: PortraitGroup[];
    profile: VerifiedPersonProfile | undefined;
    createGroup: (name: string) => Promise<{ groupId: string; slug: string; created: boolean }>;
    saveProfile: (groupId: string, patch: Partial<VerifiedPersonProfile>) => void;
    addToProject?: (input: { assetId: string; name: string; sourceUrl: string }) => void;
};

export async function groupVerifiedPhoto(input: SaveInput): Promise<{ group: PortraitGroup; created: boolean }> {
    const existing = input.groupId ? input.groups.find((group) => group.id === input.groupId) : undefined;
    if (input.groupId && !existing) throw new Error('Character group unavailable');
    if (!existing && !input.newGroupName.trim()) throw new Error('Character group name required');
    let group: PortraitGroup;
    if (existing) group = existing;
    else {
        const created = await input.createGroup(input.newGroupName.trim());
        group = { id: created.groupId, name: created.slug, displayName: input.newGroupName.trim(), groupType: 'AIGC' };
    }
    input.saveProfile(input.photo.groupId, {
        photoGroups: { ...input.profile?.photoGroups, [input.photo.assetId]: group.id }
    });
    input.addToProject?.({
        assetId: input.photo.assetId,
        name: group.displayName || group.name,
        sourceUrl: input.photo.thumbUrl
    });
    return { group, created: !existing };
}

export function groupedVerifiedPhotos(photos: VideoPortrait[], profiles: VerifiedPersonProfiles) {
    return photos.flatMap((photo) => {
        const groupId = profiles[photo.groupId]?.photoGroups?.[photo.assetId];
        return groupId && photo.status === 'Active'
            ? [{ assetId: photo.assetId, groupId, name: photo.name, previewUrl: photo.thumbUrl }]
            : [];
    });
}
