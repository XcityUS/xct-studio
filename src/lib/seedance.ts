/**
 * Seedance model catalog for the Xcity Video Studio.
 *
 * The studio talks to the Xcity TokenHub gateway (LiteLLM), which exposes
 * BytePlus/Ark Seedance models behind an OpenAI-compatible /v1/videos API.
 * The gateway passes provider params (ratio / resolution / generate_audio /
 * camera_fixed) through to Ark verbatim, so we send those explicitly instead
 * of a pixel `size` (size→ratio reduction mangles 21:9 into 7:3).
 *
 * BytePlus bills video by tokens, not by wall-clock seconds. Unit prices
 * mirror the gateway cost map (xcity-litellm model_prices_and_context_window.json,
 * byteplus/* entries).
 */

export const RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9'] as const;
export type VideoRatio = (typeof RATIOS)[number];

export const RESOLUTIONS = ['480p', '720p', '1080p', '4K'] as const;
export type VideoResolution = (typeof RESOLUTIONS)[number];

export const VIDEO_FPS = 24;

type VideoReferenceUnitPrices = {
    /** USD per 1M tokens when no reference video is attached. */
    noVideo: number;
    /** USD per 1M tokens when a reference video contributes input tokens. */
    withVideo: number;
};

type AudioUnitPrices = {
    /** USD per 1M tokens with generated audio. */
    audio: number;
    /** USD per 1M tokens without generated audio. */
    silent: number;
};

export type SeedanceUnitPrice = VideoReferenceUnitPrices | AudioUnitPrices;

export interface SeedanceModel {
    id: string;
    label: string;
    description: string;
    /** USD per 1M tokens, keyed by resolution (null = unsupported). */
    unitPrices: Record<VideoResolution, SeedanceUnitPrice | null>;
    /** Clip length bounds, in seconds — 2.5 generates far longer takes than 1.x/2.0. */
    minSeconds: number;
    maxSeconds: number;
    /**
     * How many reference images the model accepts. 1 = first-frame only;
     * >1 = the 2.0-series multi-reference mode (role "reference_image",
     * prompts cite [Image 1], [Image 2], …).
     */
    maxReferenceImages: number;
}

export const SEEDANCE_MODELS = [
    {
        id: 'seedance-1-5-pro-251215',
        label: 'Seedance 1.5 Pro',
        description: 'Native audio · best value',
        unitPrices: {
            '480p': { audio: 2.4, silent: 1.2 },
            '720p': { audio: 2.4, silent: 1.2 },
            '1080p': { audio: 2.4, silent: 1.2 },
            '4K': null
        },
        minSeconds: 4,
        maxSeconds: 12,
        maxReferenceImages: 1
    },
    {
        id: 'dreamina-seedance-2-0-260128',
        label: 'Seedance 2.0',
        description: 'High quality · audio',
        unitPrices: {
            '480p': { noVideo: 7.0, withVideo: 4.3 },
            '720p': { noVideo: 7.0, withVideo: 4.3 },
            '1080p': { noVideo: 7.7, withVideo: 4.7 },
            '4K': { noVideo: 4.0, withVideo: 2.4 }
        },
        minSeconds: 4,
        maxSeconds: 12,
        maxReferenceImages: 9
    },
    {
        id: 'dreamina-seedance-2-0-fast-260128',
        label: 'Seedance 2.0 Fast',
        description: 'Faster · no 1080p',
        unitPrices: {
            '480p': { noVideo: 5.6, withVideo: 3.3 },
            '720p': { noVideo: 5.6, withVideo: 3.3 },
            '1080p': null,
            '4K': null
        },
        minSeconds: 4,
        maxSeconds: 12,
        maxReferenceImages: 9
    },
    {
        id: 'dreamina-seedance-2-5-260628',
        label: 'Seedance 2.5',
        description: 'Up to 30s single shot',
        // Includes Xcity's 20% markup on Seedance 2.5.
        unitPrices: {
            '480p': { noVideo: 12.84, withVideo: 7.68 },
            '720p': { noVideo: 12.84, withVideo: 7.68 },
            '1080p': { noVideo: 14.04, withVideo: 8.4 },
            '4K': null
        },
        minSeconds: 4,
        maxSeconds: 30,
        maxReferenceImages: 30
    }
] as const satisfies readonly SeedanceModel[];

export type VideoModel = (typeof SEEDANCE_MODELS)[number]['id'];

/** Widest bounds across all models — the slider clamps per selected model. */
export const MIN_SECONDS = Math.min(...SEEDANCE_MODELS.map((m) => m.minSeconds));
export const MAX_SECONDS = Math.max(...SEEDANCE_MODELS.map((m) => m.maxSeconds));

export const DEFAULT_MODEL: VideoModel = 'seedance-1-5-pro-251215';
export const DEFAULT_VIDEO_REFERENCE_MODEL: VideoModel = 'dreamina-seedance-2-5-260628';
export const DEFAULT_RATIO: VideoRatio = '16:9';
export const DEFAULT_RESOLUTION: VideoResolution = '720p';
export const DEFAULT_SECONDS = 5;

export function getSeedanceModel(id: string): SeedanceModel | undefined {
    return SEEDANCE_MODELS.find((m) => m.id === id);
}

export function modelSupportsResolution(modelId: string, resolution: VideoResolution): boolean {
    return getSeedanceModel(modelId)?.unitPrices[resolution] != null;
}

/** Human display string stored in job/history `size` fields, e.g. "16:9 · 720p". */
export function formatSize(ratio: VideoRatio, resolution: VideoResolution): string {
    return `${ratio} · ${resolution}`;
}

/**
 * Inverse of formatSize, for history items predating stored createParams.
 * Returns null when the string is not in display shape (e.g. the gateway's
 * raw "16x9").
 */
export function parseSize(size: string): { ratio: VideoRatio; resolution: VideoResolution } | null {
    const [ratioPart, resolutionPart] = size.split('·').map((s) => s.trim());
    const ratio = RATIOS.find((r) => r === ratioPart);
    const resolution = RESOLUTIONS.find((r) => r === resolutionPart);
    return ratio && resolution ? { ratio, resolution } : null;
}

const RESOLUTION_HEIGHTS: Record<VideoResolution, number> = {
    '480p': 480,
    '720p': 720,
    '1080p': 1080,
    '4K': 2160
};

const SIXTEEN_BY_NINE_DIMENSIONS: Record<VideoResolution, { width: number; height: number }> = {
    '480p': { width: 854, height: 480 },
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4K': { width: 3840, height: 2160 }
};

function parseRatioParts(ratio: VideoRatio) {
    const [widthPart, heightPart] = ratio.split(':').map(Number);
    return { widthPart, heightPart };
}

function roundToEven(value: number) {
    return Math.max(2, Math.round(value / 2) * 2);
}

/**
 * Output pixels for a ratio + resolution label.
 *
 * The label names the SHORT side: 9:16 at "720p" renders 720x1280, not
 * 405x720. Treating it as the height everywhere made portrait clips look
 * three times cheaper than they are — and video is billed by pixel area.
 */
export function pixelDimensions(ratio: VideoRatio, resolution: VideoResolution): { width: number; height: number } {
    if (ratio === '16:9') {
        return SIXTEEN_BY_NINE_DIMENSIONS[resolution];
    }

    const shortSide = RESOLUTION_HEIGHTS[resolution];
    const { widthPart, heightPart } = parseRatioParts(ratio);
    if (widthPart >= heightPart) {
        return { width: roundToEven((shortSide * widthPart) / heightPart), height: shortSide };
    }
    return { width: shortSide, height: roundToEven((shortSide * heightPart) / widthPart) };
}

/** Reference-image cap for a model (1 = first-frame only). */
export function maxReferenceImages(modelId: string): number {
    return getSeedanceModel(modelId)?.maxReferenceImages ?? 1;
}

/** Duration bounds of a specific model; falls back to the widest range. */
export function secondsRange(modelId: string): { min: number; max: number } {
    const model = getSeedanceModel(modelId);
    return { min: model?.minSeconds ?? MIN_SECONDS, max: model?.maxSeconds ?? MAX_SECONDS };
}

/**
 * Clamps to the selected model's own range — bounds differ per model (2.5
 * takes 30s single shots, 1.x/2.0 cap at 12), so clamping globally would
 * silently truncate a long 2.5 request.
 */
export function clampSeconds(value: number, modelId?: string): number {
    const { min, max } = modelId ? secondsRange(modelId) : { min: MIN_SECONDS, max: MAX_SECONDS };
    if (Number.isNaN(value)) return Math.min(max, Math.max(min, DEFAULT_SECONDS));
    return Math.min(max, Math.max(min, Math.round(value)));
}
