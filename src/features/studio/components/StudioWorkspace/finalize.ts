import { isVideoResolution } from './utils';
import {
    DEFAULT_RESOLUTION,
    RESOLUTIONS,
    modelSupportsResolution,
    type VideoModel,
    type VideoResolution
} from '@/shared/config/seedance';
import type { VideoJobCreate } from '@/shared/contracts/video';

export function bestSupportedResolution(model: VideoModel): VideoResolution {
    return (
        [...RESOLUTIONS].reverse().find((resolution) => modelSupportsResolution(model, resolution)) ??
        DEFAULT_RESOLUTION
    );
}

export function finalResolutionForDraft(model: VideoModel, resolution: string | undefined): VideoResolution {
    return isVideoResolution(resolution) && modelSupportsResolution(model, resolution)
        ? resolution
        : bestSupportedResolution(model);
}

export function inputVideoSecondsFromParams(params: VideoJobCreate): number {
    if (!params.reference_video_urls?.length || !params.reference_video_seconds?.length) return 0;
    return params.reference_video_seconds
        .slice(0, params.reference_video_urls.length)
        .reduce((total, seconds) => (Number.isFinite(seconds) && seconds > 0 ? total + seconds : total), 0);
}

export function ensureFinalizeEditPrompt(prompt: string): string {
    const trimmed = prompt.trim();
    if (/编辑参考视频|edit the reference video/i.test(trimmed)) return trimmed;
    return `编辑参考视频，在保留原视频的主体、动作、构图和时序的基础上，${trimmed}`;
}
