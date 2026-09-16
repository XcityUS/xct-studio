import { MAX_REVIEW_CHECKS, REVIEW_CHECK_INTERVAL_MS, pendingReviewAssetIds, pollReviewBatch } from './review-poll-batch';
import type { ProjectAsset } from '@/shared/contracts/production';
import * as React from 'react';

export function useAssetReviewPolling(
    boundIds: (string | undefined)[],
    assets: ProjectAsset[],
    onRefresh?: (assetId: string) => Promise<ProjectAsset['status']>
) {
    const pendingKey = JSON.stringify(pendingReviewAssetIds(boundIds, assets));
    const refreshRef = React.useRef(onRefresh);
    const attemptsRef = React.useRef(new Map<string, number>());
    const finishedRef = React.useRef(new Set<string>());
    const inFlightRef = React.useRef(new Set<string>());
    const cursorRef = React.useRef(0);
    const [attemptsById, setAttemptsById] = React.useState<Record<string, number>>({});
    const enabled = Boolean(onRefresh);

    React.useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);
    React.useEffect(() => {
        const ids = JSON.parse(pendingKey) as string[];
        if (!enabled || ids.length === 0) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        const tick = async () => {
            cursorRef.current = await pollReviewBatch(
                ids, attemptsRef.current, finishedRef.current, inFlightRef.current,
                (id) => {
                    if (!refreshRef.current) throw new Error('Asset status check is unavailable.');
                    return refreshRef.current(id);
                },
                (id, count) => {
                    if (!cancelled) setAttemptsById((current) => ({ ...current, [id]: count }));
                },
                cursorRef.current
            );
            if (cancelled) return;
            if (ids.some((id) => !finishedRef.current.has(id) && (attemptsRef.current.get(id) ?? 0) < MAX_REVIEW_CHECKS)) {
                timer = setTimeout(() => void tick(), REVIEW_CHECK_INTERVAL_MS);
            }
        };
        timer = setTimeout(() => void tick(), 0);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [pendingKey, enabled]);

    return attemptsById;
}
