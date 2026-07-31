import { DEFAULT_RESOLUTION, clampSeconds, modelSupportsResolution } from '@/lib/seedance';
import type { VideoJobCreate } from '@/types/video';

/**
 * Narrows a showcase item's settings to something the target model actually
 * accepts, and reports what had to give.
 *
 * Applying them raw is unsafe: the form's own correction logic only runs on
 * user-driven Select changes, so programmatic setState would happily leave an
 * illegal pair (e.g. 1080p on 2.0 Fast, or 30s on a 12s model) that the
 * provider then rejects.
 */
export function reconcilePreset(params: VideoJobCreate): VideoJobCreate & { adjusted: string[] } {
    const model = params.model;
    const adjusted: string[] = [];

    const resolution = modelSupportsResolution(model, params.resolution)
        ? params.resolution
        : DEFAULT_RESOLUTION;
    if (resolution !== params.resolution) {
        adjusted.push(`resolution → ${resolution}`);
    }

    const seconds = clampSeconds(params.seconds, model);
    if (seconds !== params.seconds) {
        adjusted.push(`duration → ${seconds}s`);
    }

    return { ...params, model, resolution, seconds, adjusted };
}
