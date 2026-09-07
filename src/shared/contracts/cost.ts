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
