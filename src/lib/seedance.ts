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

export const RESOLUTIONS = ['480p', '720p', '1080p'] as const;
export type VideoResolution = (typeof RESOLUTIONS)[number];

export const MIN_SECONDS = 4;
export const MAX_SECONDS = 12;

export interface SeedanceModel {
    id: string;
    label: string;
    description: string;
    /** USD per generated second, keyed by resolution (null = unsupported). */
    pricePerSecond: Record<VideoResolution, number | null>;
}

export const SEEDANCE_MODELS = [
    {
        id: 'seedance-1-5-pro-251215',
        label: 'Seedance 1.5 Pro',
        description: 'Native audio · best value',
        pricePerSecond: { '480p': 0.023, '720p': 0.052, '1080p': 0.117 }
    },
    {
        id: 'dreamina-seedance-2-0-260128',
        label: 'Seedance 2.0',
        description: 'Highest quality · audio',
        pricePerSecond: { '480p': 0.067, '720p': 0.151, '1080p': 0.374 }
    },
    {
        id: 'dreamina-seedance-2-0-fast-260128',
        label: 'Seedance 2.0 Fast',
        description: 'Faster · no 1080p',
        pricePerSecond: { '480p': 0.054, '720p': 0.121, '1080p': null }
    }
] as const satisfies readonly SeedanceModel[];

export type VideoModel = (typeof SEEDANCE_MODELS)[number]['id'];

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

export function clampSeconds(value: number): number {
    if (Number.isNaN(value)) return DEFAULT_SECONDS;
    return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(value)));
}
