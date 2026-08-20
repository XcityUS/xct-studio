import {
    RATIOS,
    RESOLUTIONS,
    VIDEO_FPS,
    getSeedanceModel,
    pixelDimensions,
    type SeedanceUnitPrice,
    type VideoRatio,
    type VideoResolution
} from '@/lib/seedance';

type VideoUsage = {
    model: string;
    ratio: VideoRatio | string;
    resolution: VideoResolution | string;
    seconds: number;
    generateAudio?: boolean;
    inputVideoSeconds?: number;
};

export type CostDetails = {
    model: string;
    ratio: string;
    resolution: string;
    duration: number;
    inputVideoSeconds: number;
    width: number;
    height: number;
    fps: number;
    tokens: number;
    unitPricePerMillionTokens: number;
    lowerBound: boolean;
    /** Effective USD per output second, kept for older history UI paths. */
    pricePerSecond: number;
    totalCost: number;
};

function isVideoRatio(value: string): value is VideoRatio {
    return RATIOS.includes(value as VideoRatio);
}

function isVideoResolution(value: string): value is VideoResolution {
    return RESOLUTIONS.includes(value as VideoResolution);
}

function positiveFinite(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function selectUnitPrice(price: SeedanceUnitPrice, generateAudio: boolean, inputVideoSeconds: number): number {
    if ('audio' in price) {
        return generateAudio ? price.audio : price.silent;
    }
    return inputVideoSeconds > 0 ? price.withVideo : price.noVideo;
}

/**
 * Calculates Seedance cost using BytePlus token billing:
 * (input video seconds + output seconds) * width * height * fps / 1024.
 */
export function calculateVideoCost(usage: VideoUsage | undefined | null): CostDetails | null {
    if (
        !usage ||
        !usage.model ||
        !usage.ratio ||
        !usage.resolution ||
        typeof usage.seconds !== 'number' ||
        !Number.isFinite(usage.seconds) ||
        usage.seconds <= 0
    ) {
        console.warn('Invalid or missing usage data for cost calculation:', usage);
        return null;
    }

    const { model, seconds } = usage;
    const ratio = String(usage.ratio);
    const resolution = String(usage.resolution);
    if (!isVideoRatio(ratio) || !isVideoResolution(resolution)) {
        console.warn(`Invalid ratio/resolution for cost calculation: ratio=${ratio} resolution=${resolution}`);
        return null;
    }

    const modelDef = getSeedanceModel(model);
    const unitPriceDef = modelDef?.unitPrices[resolution];
    if (unitPriceDef == null) {
        console.warn(`No price for model=${model} resolution=${resolution}`);
        return null;
    }

    const inputVideoSeconds = positiveFinite(usage.inputVideoSeconds);
    const { width, height } = pixelDimensions(ratio, resolution);
    const tokens = ((inputVideoSeconds + seconds) * width * height * VIDEO_FPS) / 1024;
    const unitPricePerMillionTokens = selectUnitPrice(unitPriceDef, usage.generateAudio ?? true, inputVideoSeconds);
    const totalCost = (tokens * unitPricePerMillionTokens) / 1_000_000;
    const pricePerSecond = totalCost / seconds;

    return {
        model,
        ratio,
        resolution,
        duration: seconds,
        inputVideoSeconds,
        width,
        height,
        fps: VIDEO_FPS,
        tokens,
        unitPricePerMillionTokens,
        lowerBound: inputVideoSeconds > 0,
        pricePerSecond,
        totalCost
    };
}
