import type { PlayerBehavior, PlayerCallbacks } from './types';
import { requestExclusiveVideoPlayback, subscribeExclusiveVideoPlayback } from '@/shared/media/exclusive-video-playback';
import type Artplayer from 'artplayer';
import * as React from 'react';

type PlayerSetup = PlayerBehavior & {
    containerRef: React.RefObject<HTMLDivElement | null>;
    latestRef: React.RefObject<PlayerCallbacks>;
    loadedSourceRef: React.RefObject<string | null>;
    locale: string;
};

export function useLatestPlayerProps(props: PlayerCallbacks) {
    const latestRef = React.useRef(props);
    React.useEffect(() => {
        latestRef.current = props;
    }, [props]);
    return latestRef;
}

function createPlayer(ArtplayerConstructor: typeof Artplayer, setup: PlayerSetup) {
    const container = setup.containerRef.current;
    if (!container) return null;
    const theme = getComputedStyle(container).getPropertyValue('--studio-media-foreground').trim();

    return new ArtplayerConstructor({
        container,
        url: setup.latestRef.current.src,
        poster: setup.latestRef.current.poster || '',
        lang: setup.locale === 'zh' ? 'zh-cn' : 'en',
        theme,
        autoplay: setup.autoPlay,
        loop: setup.loop,
        muted: setup.muted,
        playbackRate: true,
        aspectRatio: true,
        setting: true,
        hotkey: true,
        pip: true,
        mutex: true,
        fullscreen: true,
        fullscreenWeb: true,
        miniProgressBar: true,
        playsInline: true,
        moreVideoAttr: { preload: setup.preload }
    });
}

function bindPlayerEvents(player: Artplayer, latestRef: React.RefObject<PlayerCallbacks>, playbackToken: string) {
    player.on('video:error', () => latestRef.current.onSourceError?.());
    player.on('video:play', () => requestExclusiveVideoPlayback(playbackToken));
    player.on('video:loadedmetadata', () => {
        const duration = player.duration;
        if (Number.isFinite(duration) && duration > 0) latestRef.current.onDurationChange?.(duration);
        if (!latestRef.current.poster && player.currentTime === 0) player.currentTime = 0.001;
    });
}

export function usePlayerInstance(setup: PlayerSetup) {
    const playerRef = React.useRef<Artplayer | null>(null);
    const playbackToken = `artplayer:${React.useId()}`;
    const { autoPlay, containerRef, instanceKey, latestRef, loadedSourceRef, locale, loop, muted, preload } = setup;

    React.useEffect(() => {
        let disposed = false;
        let instance: Artplayer | null = null;
        let unsubscribeExclusivePlayback: (() => void) | undefined;

        void import('artplayer')
            .then(({ default: ArtplayerConstructor }) => {
                if (disposed) return;
                instance = createPlayer(ArtplayerConstructor, {
                    autoPlay,
                    containerRef,
                    instanceKey,
                    latestRef,
                    loadedSourceRef,
                    locale,
                    loop,
                    muted,
                    preload
                });
                if (!instance) return;
                playerRef.current = instance;
                loadedSourceRef.current = latestRef.current.src;
                bindPlayerEvents(instance, latestRef, playbackToken);
                unsubscribeExclusivePlayback = subscribeExclusiveVideoPlayback(
                    playbackToken,
                    () => {
                        if (instance && !instance.isDestroy && instance.playing) instance.pause();
                    }
                );
            })
            .catch((error: unknown) => {
                console.warn('ArtPlayer failed to initialize:', error);
                latestRef.current.onSourceError?.();
            });

        return () => {
            disposed = true;
            unsubscribeExclusivePlayback?.();
            instance?.destroy();
            if (playerRef.current === instance) playerRef.current = null;
        };
    }, [autoPlay, containerRef, instanceKey, latestRef, loadedSourceRef, locale, loop, muted, playbackToken, preload]);

    return playerRef;
}

export function usePlayerSource(
    playerRef: React.RefObject<Artplayer | null>,
    loadedSourceRef: React.RefObject<string | null>,
    latestRef: React.RefObject<PlayerCallbacks>,
    src: string
) {
    React.useEffect(() => {
        const player = playerRef.current;
        if (!player || loadedSourceRef.current === src) return;

        loadedSourceRef.current = src;
        const shouldResume = player.playing;
        void player
            .switchQuality(src)
            .then(() => {
                if (shouldResume && !player.isDestroy) void player.play();
            })
            .catch((error: unknown) => {
                console.warn('ArtPlayer could not switch video source:', error);
                latestRef.current.onSourceError?.();
            });
    }, [latestRef, loadedSourceRef, playerRef, src]);
}

export function usePlayerPoster(playerRef: React.RefObject<Artplayer | null>, poster?: string | null) {
    React.useEffect(() => {
        const player = playerRef.current;
        if (player) player.poster = poster || '';
    }, [playerRef, poster]);
}
