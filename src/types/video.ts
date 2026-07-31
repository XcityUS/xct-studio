import type { VideoModel, VideoRatio, VideoResolution } from '@/lib/seedance';
import { CostDetails } from '@/lib/cost-utils';

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
    error?: {
        message: string;
        code?: string;
    };
    remix_of?: string;
};

export type VideoMetadata = {
    id: string;
    timestamp: number;
    filename: string;
    storageModeUsed?: 'fs' | 'indexeddb';
    durationMs: number;
    model: string;
    size: string;
    seconds: number;
    prompt: string;
    mode: 'create' | 'remix';
    /** Permanent R2 URL once archived — outlives the provider's 24h CDN link. */
    storedUrl?: string;
    /**
     * Exact submission parameters, kept for reuse/regenerate. Items created
     * before this field existed fall back to parsing `size`/`model`.
     */
    createParams?: VideoJobCreate;
    costDetails: CostDetails | null;
    remix_of?: string;
    status?: 'processing' | 'completed' | 'failed';
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
    /** Public image URL for image-to-video (the gateway forwards it to Ark). */
    input_reference_url?: string;
    /** Lock the camera in place (BytePlus provider param, passed through). */
    camera_fixed?: boolean;
};
