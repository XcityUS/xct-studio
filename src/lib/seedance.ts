/**
 * Seedance model catalog for the Xcity Video Studio.
 *
 * The studio talks to the Xcity TokenHub gateway (LiteLLM), which exposes
 * BytePlus/Ark Seedance models behind an OpenAI-compatible /v1/videos API.
 * The gateway passes provider params (ratio / resolution / generate_audio /
 * camera_fixed) through to Ark verbatim, so we send those explicitly instead
 * of a pixel `size` (size→ratio reduction mangles 21:9 into 7:3).
 *
 * Per-second prices mirror the gateway cost map
 * (xcity-litellm model_prices_and_context_window.json, byteplus/* entries);
 * 480p figures are derived from the same Ark token formula.
 */

export const RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9'] as const;
export type VideoRatio = (typeof RATIOS)[number];

export const RESOLUTIONS = ['480p', '720p', '1080p', '4K'] as const;
export type VideoResolution = (typeof RESOLUTIONS)[number];

export interface SeedanceModel {
    id: string;
    label: string;
    description: string;
    /** USD per generated second, keyed by resolution (null = unsupported). */
    pricePerSecond: Record<VideoResolution, number | null>;
    /** Clip length bounds, in seconds — 2.5 generates far longer takes than 1.x/2.0. */
    minSeconds: number;
    maxSeconds: number;
    /** Shown when a model's pricing is provisional rather than published. */
    priceIsEstimate?: boolean;
}

export const SEEDANCE_MODELS = [
    {
        id: 'seedance-1-5-pro-251215',
        label: 'Seedance 1.5 Pro',
        description: 'Native audio · best value',
        pricePerSecond: { '480p': 0.023, '720p': 0.052, '1080p': 0.117, '4K': null },
        minSeconds: 4,
        maxSeconds: 12
    },
    {
        id: 'dreamina-seedance-2-0-260128',
        label: 'Seedance 2.0',
        description: 'High quality · audio',
        pricePerSecond: { '480p': 0.067, '720p': 0.151, '1080p': 0.374, '4K': null },
        minSeconds: 4,
        maxSeconds: 12
    },
    {
        id: 'dreamina-seedance-2-0-fast-260128',
        label: 'Seedance 2.0 Fast',
        description: 'Faster · no 1080p',
        pricePerSecond: { '480p': 0.054, '720p': 0.121, '1080p': null, '4K': null },
        minSeconds: 4,
        maxSeconds: 12
    },
    {
        id: 'dreamina-seedance-2-5-260628',
        label: 'Seedance 2.5',
        description: 'Up to 30s single shot · 4K',
        // BytePlus has not published 2.5 rates (beta). These mirror 2.0's
        // published ladder, with 4K extrapolated at 2x 1080p, so jobs bill
        // something defensible instead of $0. Replace at GA.
        pricePerSecond: { '480p': 0.067, '720p': 0.151, '1080p': 0.374, '4K': 0.748 },
        minSeconds: 4,
        maxSeconds: 30,
        priceIsEstimate: true
    }
] as const satisfies readonly SeedanceModel[];

export type VideoModel = (typeof SEEDANCE_MODELS)[number]['id'];

/** Widest bounds across all models — the slider clamps per selected model. */
export const MIN_SECONDS = Math.min(...SEEDANCE_MODELS.map((m) => m.minSeconds));
export const MAX_SECONDS = Math.max(...SEEDANCE_MODELS.map((m) => m.maxSeconds));

export const DEFAULT_MODEL: VideoModel = 'seedance-1-5-pro-251215';
export const DEFAULT_RATIO: VideoRatio = '16:9';
export const DEFAULT_RESOLUTION: VideoResolution = '720p';
export const DEFAULT_SECONDS = 5;

export function getSeedanceModel(id: string): SeedanceModel | undefined {
    return SEEDANCE_MODELS.find((m) => m.id === id);
}

export function modelSupportsResolution(modelId: string, resolution: VideoResolution): boolean {
    return getSeedanceModel(modelId)?.pricePerSecond[resolution] != null;
}

/** Human display string stored in job/history `size` fields, e.g. "16:9 · 720p". */
export function formatSize(ratio: VideoRatio, resolution: VideoResolution): string {
    return `${ratio} · ${resolution}`;
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
