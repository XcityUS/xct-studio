import { newestHistoryFirst } from '@/features/generation/history/order';
import type { VideoMetadata } from '@/shared/contracts/video';
import { describe, expect, it } from 'vitest';

function item(id: string, timestamp: number, updatedAt?: number): VideoMetadata {
    return {
        id,
        timestamp,
        updatedAt,
        filename: `${id}.mp4`,
        durationMs: 0,
        model: 'test-model',
        size: '16:9 · 480p',
        seconds: 5,
        prompt: id,
        mode: 'create',
        costDetails: null
    };
}

describe('video history ordering', () => {
    it('sorts newest creation time first without mutating the source list', () => {
        const source = [
            item('older', 1_700_000_000_000),
            item('newest', 1_700_000_002_000),
            item('middle', 1_700_000_001_000)
        ];

        expect(newestHistoryFirst(source).map(({ id }) => id)).toEqual(['newest', 'middle', 'older']);
        expect(source.map(({ id }) => id)).toEqual(['older', 'newest', 'middle']);
    });

    it('normalizes legacy second timestamps and uses updates only to break ties', () => {
        const source = [
            item('milliseconds', 1_700_000_001_000),
            item('seconds-newest', 1_700_000_002),
            item('tie-updated', 1_700_000_001, 1_700_000_003_000)
        ];

        expect(newestHistoryFirst(source).map(({ id }) => id)).toEqual([
            'seconds-newest',
            'tie-updated',
            'milliseconds'
        ]);
    });
});
