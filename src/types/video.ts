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
};
