import * as React from 'react';

const EXCLUSIVE_VIDEO_PLAYBACK_EVENT = 'xct:exclusive-video-playback';

type PlaybackDetail = {
    token: string;
};

export function requestExclusiveVideoPlayback(token: string) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<PlaybackDetail>(EXCLUSIVE_VIDEO_PLAYBACK_EVENT, { detail: { token } }));
}

export function subscribeExclusiveVideoPlayback(token: string, pause: () => void) {
    if (typeof window === 'undefined') return () => undefined;
    const listener = (event: Event) => {
        const detail = (event as CustomEvent<PlaybackDetail>).detail;
        if (detail?.token && detail.token !== token) pause();
    };
    window.addEventListener(EXCLUSIVE_VIDEO_PLAYBACK_EVENT, listener);
    return () => window.removeEventListener(EXCLUSIVE_VIDEO_PLAYBACK_EVENT, listener);
}

export function useExclusiveHtmlVideoPlayback(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    token: string,
    onExclusivePause?: () => void
) {
    React.useEffect(() => {
        const video = videoRef.current;
        if (!video) return undefined;
        const onPlay = () => requestExclusiveVideoPlayback(token);
        const unsubscribe = subscribeExclusiveVideoPlayback(token, () => {
            if (!video.paused) {
                video.pause();
                onExclusivePause?.();
            }
        });
        video.addEventListener('play', onPlay);
        return () => {
            unsubscribe();
            video.removeEventListener('play', onPlay);
        };
    }, [onExclusivePause, token, videoRef]);
}
