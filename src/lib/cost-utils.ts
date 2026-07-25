import { getSeedanceModel, type VideoResolution } from '@/lib/seedance';

type VideoUsage = {
    model: string;
    resolution: VideoResolution | string;
    seconds: number;
};

export type CostDetails = {
    model: string;
    resolution: string;
    duration: number;
    pricePerSecond: number;
    totalCost: number;
};

/**
 * Calculates the cost of a Seedance video generation from the model's
 * per-second price table (mirrors the TokenHub gateway cost map).
 */
export function calculateVideoCost(usage: VideoUsage | undefined | null): CostDetails | null {
    if (!usage || !usage.model || !usage.resolution || typeof usage.seconds !== 'number') {
        console.warn('Invalid or missing usage data for cost calculation:', usage);
        return null;
    }

    const { model, resolution, seconds } = usage;

    const modelDef = getSeedanceModel(model);
    const pricePerSecond = modelDef?.pricePerSecond[resolution as VideoResolution];
    if (pricePerSecond == null) {
        console.warn(`No price for model=${model} resolution=${resolution}`);
        return null;
    }

    const totalCost = Math.round(seconds * pricePerSecond * 1000) / 1000;

    return {
        model,
        resolution: String(resolution),
        duration: seconds,
        pricePerSecond,
        totalCost
    };
}
