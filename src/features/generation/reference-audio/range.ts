export type AudioRange = { startSeconds: number; endSeconds: number };

export const UNKNOWN_AUDIO_DURATION_SECONDS = 600;
export const MIN_AUDIO_RANGE_SECONDS = 2;

export function audioTimelineSeconds(duration: number | null): number {
    return duration !== null && Number.isFinite(duration) && duration > 0
        ? Math.floor(duration)
        : UNKNOWN_AUDIO_DURATION_SECONDS;
}

export function clampAudioRange(range: AudioRange, maxSeconds: number, timelineSeconds: number): AudioRange {
    const maximum = Math.max(MIN_AUDIO_RANGE_SECONDS, Math.floor(timelineSeconds));
    const window = Math.max(MIN_AUDIO_RANGE_SECONDS, Math.floor(maxSeconds));
    const startSeconds = Math.min(Math.max(0, Math.floor(range.startSeconds)), maximum - MIN_AUDIO_RANGE_SECONDS);
    const endSeconds = Math.min(
        maximum,
        startSeconds + window,
        Math.max(startSeconds + MIN_AUDIO_RANGE_SECONDS, Math.floor(range.endSeconds))
    );
    return { startSeconds, endSeconds };
}

export function moveAudioRange(
    range: AudioRange,
    thumb: 'start' | 'end',
    value: number,
    maxSeconds: number,
    timelineSeconds: number
): AudioRange {
    const timeline = Math.max(MIN_AUDIO_RANGE_SECONDS, Math.floor(timelineSeconds));
    const window = Math.max(MIN_AUDIO_RANGE_SECONDS, Math.floor(maxSeconds));
    if (thumb === 'start') {
        const startSeconds = Math.min(Math.max(0, Math.floor(value)), timeline - MIN_AUDIO_RANGE_SECONDS);
        const endSeconds =
            startSeconds > range.endSeconds - MIN_AUDIO_RANGE_SECONDS
                ? Math.min(timeline, startSeconds + window)
                : Math.min(range.endSeconds, startSeconds + window);
        return { startSeconds, endSeconds };
    }
    const endSeconds = Math.min(timeline, Math.max(MIN_AUDIO_RANGE_SECONDS, Math.floor(value)));
    const startSeconds =
        endSeconds < range.startSeconds + MIN_AUDIO_RANGE_SECONDS
            ? Math.max(0, endSeconds - MIN_AUDIO_RANGE_SECONDS)
            : Math.max(range.startSeconds, endSeconds - window);
    return { startSeconds, endSeconds };
}
