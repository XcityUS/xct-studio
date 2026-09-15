import type { VideoMetadata } from '@/shared/contracts/video';

function milliseconds(value: number | undefined) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
    return value < 1_000_000_000_000 ? value * 1000 : value;
}

function createdAt(item: VideoMetadata) {
    return milliseconds(item.timestamp) || milliseconds(item.updatedAt);
}

/** Newest generated item first; preserve incoming order when timestamps tie. */
export function newestHistoryFirst(items: readonly VideoMetadata[]): VideoMetadata[] {
    return items
        .map((item, index) => ({ item, index }))
        .sort((left, right) => {
            const createdDifference = createdAt(right.item) - createdAt(left.item);
            if (createdDifference) return createdDifference;
            const updatedDifference = milliseconds(right.item.updatedAt) - milliseconds(left.item.updatedAt);
            return updatedDifference || left.index - right.index;
        })
        .map(({ item }) => item);
}
