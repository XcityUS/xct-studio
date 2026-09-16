import { MAX_REVIEW_CHECKS, pendingReviewAssetIds, pollReviewBatch } from '@/features/generation/components/CreationForm/StoryboardDraftPanel/review-poll-batch';
import type { ProjectAsset } from '@/shared/contracts/production';
import { describe, expect, it, vi } from 'vitest';

function asset(id: string, status: ProjectAsset['status']): ProjectAsset {
    return {
        id, projectId: 'project-1', name: id, kind: 'image', status,
        sourceType: 'provider', providerAssetId: id, createdAt: 1, updatedAt: 1
    };
}

describe('storyboard review polling', () => {
    it('polls only unique bound reviewing IDs', () => {
        expect(pendingReviewAssetIds(
            ['asset-1', 'asset-1', 'asset-2', 'asset-3', undefined],
            [asset('asset-1', 'reviewing'), asset('asset-2', 'active'), asset('asset-3', 'failed')]
        )).toEqual(['asset-1']);
    });

    it('stops as soon as the provider reports an active or failed terminal state', async () => {
        const attempts = new Map<string, number>();
        const finished = new Set<string>();
        const inFlight = new Set<string>();
        const check = vi.fn(async (id: string) => id === 'ready' ? 'active' as const : 'failed' as const);
        await pollReviewBatch(['ready', 'failed'], attempts, finished, inFlight, check, () => {}, 0);
        await pollReviewBatch(['ready', 'failed'], attempts, finished, inFlight, check, () => {}, 0);
        expect(check).toHaveBeenCalledTimes(2);
        expect(finished).toEqual(new Set(['ready', 'failed']));
    });

    it('caps each ID at 20 checks even when it remains pending or reads fail', async () => {
        const attempts = new Map<string, number>();
        const finished = new Set<string>();
        const inFlight = new Set<string>();
        const check = vi.fn(async (id: string) => {
            if (id === 'unreachable') throw new Error('network');
            return 'reviewing' as const;
        });
        const progress = vi.fn();
        for (let index = 0; index < MAX_REVIEW_CHECKS + 2; index++) {
            await pollReviewBatch(['pending', 'unreachable'], attempts, finished, inFlight, check, progress, 0);
        }
        expect(check).toHaveBeenCalledTimes(MAX_REVIEW_CHECKS * 2);
        expect(attempts.get('pending')).toBe(MAX_REVIEW_CHECKS);
        expect(attempts.get('unreachable')).toBe(MAX_REVIEW_CHECKS);
        expect(progress).toHaveBeenCalledWith('pending', MAX_REVIEW_CHECKS);
    });

    it('limits concurrent checks and rotates through multiple pending IDs', async () => {
        const attempts = new Map<string, number>();
        const finished = new Set<string>();
        const inFlight = new Set<string>();
        const check = vi.fn(async () => 'reviewing' as const);
        const ids = ['asset-1', 'asset-2', 'asset-3', 'asset-4'];
        const cursor = await pollReviewBatch(ids, attempts, finished, inFlight, check, () => {}, 0);
        expect(check).toHaveBeenCalledTimes(3);
        await pollReviewBatch(ids, attempts, finished, inFlight, check, () => {}, cursor);
        expect(attempts.get('asset-4')).toBe(1);
    });
});
