import type { PortraitGroup } from '@/features/assets/portrait/api';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import { virtualCharacterOptions } from '@/features/generation/components/CreationForm/CharacterSelectors/options';
import type { VideoPortrait } from '@/features/generation/history/merge';
import { describe, expect, it } from 'vitest';

function portrait(
    assetId: string,
    groupId: string,
    updatedAt: number,
    patch: Partial<VideoPortrait> = {}
): VideoPortrait {
    return {
        assetId,
        groupId,
        groupType: 'AIGC',
        name: assetId,
        thumbUrl: `https://media.example/${assetId}.png`,
        status: 'Active',
        updatedAt,
        ...patch
    };
}

function group(id: string, slug: string): PortraitGroup {
    return {
        id,
        name: `xcity:user-1:${slug}`,
        groupType: 'AIGC'
    };
}

describe('virtualCharacterOptions', () => {
    it('returns one latest active option for each virtual-character group', () => {
        const options = virtualCharacterOptions(
            [
                portrait('asset-old', 'group-a', 10),
                portrait('asset-new', 'group-a', 20),
                portrait('asset-b', 'group-b', 15),
                portrait('asset-processing', 'group-c', 30, { status: 'Processing' }),
                portrait('asset-person', 'group-d', 40, { groupType: 'LivenessFace' })
            ],
            []
        );

        expect(options.map((item) => item.assetId)).toEqual(['asset-new', 'asset-b']);
    });

    it('keeps the attached group member visible instead of replacing it with a newer asset', () => {
        const selected = portrait('asset-selected', 'group-a', 10);
        const options = virtualCharacterOptions(
            [selected, portrait('asset-new', 'group-a', 20)],
            [portraitReferenceUrl(selected.assetId)]
        );

        expect(options.map((item) => item.assetId)).toEqual([selected.assetId]);
    });

    it('keeps legacy entries without a group as separate choices', () => {
        const options = virtualCharacterOptions([portrait('asset-a', '', 10), portrait('asset-b', '', 20)], []);

        expect(options.map((item) => item.assetId)).toEqual(['asset-b', 'asset-a']);
    });

    it('only returns portraits that belong to supplied Xcity character groups', () => {
        const options = virtualCharacterOptions(
            [
                portrait('asset-xcity', 'group-xcity', 10),
                portrait('asset-other', 'group-other', 20),
                portrait('asset-orphan', '', 30)
            ],
            [],
            [group('group-xcity', 'urban-men')]
        );

        expect(options).toMatchObject([{ assetId: 'asset-xcity', displayName: 'urban-men' }]);
    });

    it('excludes the reviewed-materials bucket from virtual character options', () => {
        const options = virtualCharacterOptions(
            [portrait('asset-review', 'group-review', 10)],
            [],
            [group('group-review', 'reviewed-materials')]
        );

        expect(options).toEqual([]);
    });
});
