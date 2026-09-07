import type { VideoJob, VideoMetadata } from '@/shared/contracts/video';

export function formatVideoMegabytes(bytes?: number): string | null {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

export function getHistoryItemState(item: VideoMetadata, job?: VideoJob, hasPlayableMedia = false) {
    const isFailed = job?.status === 'failed' || item.status === 'failed';
    const isCompleted =
        !isFailed && (hasPlayableMedia || job?.status === 'completed' || (item.status ?? 'completed') === 'completed');
    const isProcessing =
        !isCompleted &&
        !isFailed &&
        (item.status === 'submitting' ||
            item.status === 'processing' ||
            job?.status === 'queued' ||
            job?.status === 'in_progress');

    return { isProcessing, isFailed, isCompleted };
}

export function hasTokenCostDetails(costDetails: VideoMetadata['costDetails']): boolean {
    return Boolean(
        costDetails &&
            typeof costDetails.tokens === 'number' &&
            Number.isFinite(costDetails.tokens) &&
            typeof costDetails.unitPricePerMillionTokens === 'number' &&
            Number.isFinite(costDetails.unitPricePerMillionTokens)
    );
}

export function formatTokens(tokens: number): string {
    return Math.round(tokens).toLocaleString();
}
