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

        expect(options).toEqual([selected]);
    });

    it('keeps legacy entries without a group as separate choices', () => {
        const options = virtualCharacterOptions([portrait('asset-a', '', 10), portrait('asset-b', '', 20)], []);

        expect(options.map((item) => item.assetId)).toEqual(['asset-b', 'asset-a']);
    });
});
