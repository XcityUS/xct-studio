import { CostDetails } from '@/lib/cost-utils';
import type { VideoModel, VideoRatio, VideoResolution } from '@/lib/seedance';

/**
 * Normalized video job as returned by the TokenHub gateway's OpenAI-style
 * /v1/videos API. `model`, `size` and `seconds` stay loose strings: the
 * gateway echoes provider-shaped values (e.g. size "16x9", seconds "5").
 */
export type VideoJob = {
    id: string;
    object: 'video';
    created_at: number;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    model: string;
    progress: number; // 0-100
    seconds: string;
    size: string;
    /**
     * Direct CDN link to the finished asset. Preferred over the gateway's
     * /content route, which proxies the whole file (and is currently broken
     * for BytePlus). Present once the job completes.
     */
    output_url?: string;
    prompt?: string;
    seed?: number;
    error?: {
        message: string;
        code?: string;
    };
    remix_of?: string;
};

export type VideoMetadata = {
    id: string;
    timestamp: number;
    /** Last metadata mutation time. Used to resolve cloud sync conflicts for the same video id. */
    updatedAt?: number;
    filename: string;
    storageModeUsed?: 'fs' | 'indexeddb' | 'r2';
    /** Finished video file size in bytes, when known from local download or R2 archive metadata. */
    fileSizeBytes?: number;
    durationMs: number;
    model: string;
    size: string;
    seconds: number;
    /** User-facing display name for history/share surfaces. Falls back to prompt when absent. */
    title?: string;
    prompt: string;
    mode: 'create' | 'remix';
    /** Permanent R2 URL once archived — outlives the provider's 24h CDN link. */
    storedUrl?: string;
    /** Provider CDN URL captured at completion time. Temporary; may expire after provider retention. */
    providerUrl?: string;
    /** Studio branding watermark burned into the playable/exported video. */
    brandingWatermark?: {
        enabled: boolean;
        text?: string;
        /** Durable original video URL, without the Studio watermark. */
        originalUrl?: string;
        /** Durable watermarked video URL for the current watermark text. */
        watermarkedUrl?: string;
    };
    /**
     * Exact submission parameters, kept for reuse/regenerate. Items created
     * before this field existed fall back to parsing `size`/`model`.
     */
    createParams?: VideoJobCreate;
    costDetails: CostDetails | null;
    draft?: boolean;
    finalResolution?: string;
    /** Finalize source path: 0 = providerUrl update, 1 = storedUrl update, 2 = create with current-video URL reference. */
    finalizeFlag?: 0 | 1 | 2;
    remix_of?: string;
    /** Temporary link used by regenerate: this completed item should replace the old history id. */
    replacesId?: string;
    status?: 'submitting' | 'processing' | 'completed' | 'failed';
    /** True when finished media bytes are no longer reachable from provider storage. */
    mediaExpired?: boolean;
    error?: string;
    progress?: number;
};

export type VideoJobCreate = {
    model: VideoModel;
    prompt: string;
    ratio: VideoRatio;
    resolution: VideoResolution;
    seconds: number;
    generate_audio: boolean;
    /**
     * Public image URL for image-to-video, first-frame mode (the output
     * ratio follows this image; `ratio` is omitted from the request).
     */
    input_reference_url?: string;
    /**
     * Optional end frame for first-frame mode. Used only together with
     * `input_reference_url`; history stores the public URL, not inlined data.
     */
    last_frame_url?: string;
    /**
     * Multi-reference mode (Seedance 2.0/2.5, up to 9): each URL is sent with
     * role "reference_image"; prompts cite them as [Image 1], [Image 2], ….
     * Takes precedence over `input_reference_url` when non-empty.
     */
    reference_image_urls?: string[];
    /** Optional video references. Prompts cite them as [Video 1], [Video 2], …. */
    reference_video_urls?: string[];
    /** Studio-only durations for reference video cost estimates, aligned with `reference_video_urls`. */
    reference_video_seconds?: number[];
    /** Studio-only legacy passthrough marker retained for saved form compatibility. */
    passthrough_reference_video_urls?: string[];
    /** BytePlus omni-reference task type for video reference workflows such as Finalize. */
    omni_reference_task_type?: 'edit' | 'extend';
    /** Provider ratio override for omni-reference video editing/extension. */
    omni_reference_ratio?: 'adaptive';
    /** Provider duration override for omni-reference workflows. Do not set for video editing tasks. */
    omni_reference_duration?: number;
    /** Omit resolution for provider task types where output specs follow the reference video. */
    omit_resolution?: boolean;
    /** Omit ratio for provider task types where the output follows the reference video. */
    omit_ratio?: boolean;
    /** Omit seconds/duration for provider task types where the output follows the reference video. */
    omit_duration?: boolean;
    /**
     * Optional background music / timbre reference for multi-reference mode.
     * History stores the public URL; submit code may inline it as a data URI.
     */
    reference_audio_url?: string;
    /** Lock the camera in place (BytePlus provider param, passed through). */
    camera_fixed?: boolean;
    /** Deterministic generation seed; absent means provider-random. */
    seed?: number;
    /** Studio-only generation ladder flag. Omitted from the gateway request. */
    draft?: boolean;
    /** Studio-only final target resolution for a draft. Omitted from the gateway request. */
    final_resolution?: string;
    /** Studio branding watermark preference; handled after provider generation. */
    watermark?: boolean;
    /** Studio branding watermark text; handled after provider generation. */
    watermarkText?: string;
    /** Studio-only prompt guard to discourage model-rendered subtitles or on-screen text. */
    avoid_generated_captions?: boolean;
    /** Studio-only custom caption text directives, capped by the create form. */
    generated_captions?: string[];
    /** Studio-only language ids aligned with generated_captions. */
    generated_caption_languages?: string[];
    /** Studio-only spoken dialogue language selector. */
    voice_language?: string;
    /** Studio-only subtitle language selector. */
    caption_mode?: string;
    /** Studio-only opening title overlay toggle. */
    title_overlay_enabled?: boolean;
    /** Studio-only opening title text. */
    title_overlay_text?: string;
    /** Studio-only opening title visual style. */
    title_overlay_style?: string;
    /** Studio-only opening title display duration. */
    title_overlay_duration?: string;
};
