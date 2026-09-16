import type { VideoJob, VideoMetadata } from '@/shared/contracts/video';
export { newestHistoryFirst } from '@/features/generation/history/order';

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

export function summarizeHistoryCost(history: VideoMetadata[], activeJobs?: Map<string, VideoJob>) {
    let cost = 0;
    let successfulVideos = 0;
    let failedVideos = 0;
    let billedVideos = 0;
    history.forEach((item) => {
        const state = getHistoryItemState(item, activeJobs?.get(item.id));
        if (item.costDetails && state.isCompleted) {
            cost += item.costDetails.totalCost;
            billedVideos += 1;
        }
        if (state.isCompleted) successfulVideos += 1;
        if (state.isFailed) failedVideos += 1;
    });
    return { totalCost: Math.round(cost * 100) / 100, totalVideos: history.length, successfulVideos, failedVideos, billedVideos };
}
