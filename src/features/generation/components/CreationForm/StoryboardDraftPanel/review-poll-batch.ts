import { assetBindingStatus } from './AssetBindingPicker/choices';
import type { ProjectAsset } from '@/shared/contracts/production';

export const MAX_REVIEW_CHECKS = 20;
export const REVIEW_CHECK_INTERVAL_MS = 5000;
const REVIEW_CHECK_BATCH_SIZE = 3;

export function pendingReviewAssetIds(boundIds: (string | undefined)[], assets: ProjectAsset[]): string[] {
    return [...new Set(boundIds.map((id) => id?.trim()).filter((id): id is string => Boolean(id)))]
        .filter((id) => assetBindingStatus(id, assets) === 'reviewing')
        .sort();
}

export async function pollReviewBatch(
    pendingIds: string[],
    attempts: Map<string, number>,
    finished: Set<string>,
    inFlight: Set<string>,
    check: (id: string) => Promise<ProjectAsset['status']>,
    onAttempt: (id: string, count: number) => void,
    cursor: number
): Promise<number> {
    const eligible = pendingIds.filter((id) => !finished.has(id) && !inFlight.has(id) && (attempts.get(id) ?? 0) < MAX_REVIEW_CHECKS);
    if (eligible.length === 0) return 0;
    const count = Math.min(eligible.length, REVIEW_CHECK_BATCH_SIZE);
    const batch = Array.from({ length: count }, (_, index) => eligible[(cursor + index) % eligible.length]);
    await Promise.all(batch.map(async (id) => {
        const nextAttempt = (attempts.get(id) ?? 0) + 1;
        attempts.set(id, nextAttempt);
        inFlight.add(id);
        try {
            const status = await check(id);
            if (status === 'active' || status === 'failed' || status === 'revoked' || status === 'archived') finished.add(id);
        } catch {
            // A failed read still counts toward the cap; another scheduled pass may recover.
        } finally {
            inFlight.delete(id);
            onAttempt(id, nextAttempt);
        }
    }));
    return (cursor + count) % eligible.length;
}
