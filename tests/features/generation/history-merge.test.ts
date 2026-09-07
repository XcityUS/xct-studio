import { mergeDocs, type HistoryDoc, type VideoPortrait } from '@/features/generation/history/merge';
import { describe, expect, it } from 'vitest';

function doc(portraits: VideoPortrait[]): HistoryDoc {
    return {
        updatedAt: 0,
        history: [],
        characters: [],
        portraits,
        declarations: {},
        deletedIds: []
    };
}

function portrait(status: VideoPortrait['status'], updatedAt: number): VideoPortrait {
    return {
        assetId: 'asset-1',
        groupId: 'group-1',
        groupType: 'AIGC',
        name: 'Character',
        thumbUrl: 'https://media.xcity.ai/media/u/user/character.png',
        status,
        updatedAt
    };
}

describe('portrait state merge', () => {
    it('keeps a terminal provider state when another device still has processing', () => {
        const merged = mergeDocs(doc([portrait('Processing', 200)]), doc([portrait('Active', 100)]));

        expect(merged.portraits).toEqual([portrait('Active', 100)]);
    });

    it('uses the newest terminal result and preserves its failure reason', () => {
        const failed = { ...portrait('Failed', 300), failureReason: 'Rejected by provider' };
        const merged = mergeDocs(doc([failed]), doc([portrait('Active', 100)]));

        expect(merged.portraits).toEqual([failed]);
    });
});
