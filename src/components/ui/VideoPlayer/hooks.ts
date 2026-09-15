import type { PlayerBehavior, PlayerCallbacks } from './types';
import {
    requestExclusiveVideoPlayback,
    subscribeExclusiveVideoPlayback
} from '@/shared/media/exclusive-video-playback';
import type Artplayer from 'artplayer';
import * as React from 'react';

const SUBTITLE_VISIBILITY_STORAGE_KEY = 'xctSubtitleVisible';
const SUBTITLE_OFFSET_STORAGE_PREFIX = 'xctSubtitleOffset:';

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
        subtitleOffset: Boolean(setup.subtitle),
        miniProgressBar: true,
        playsInline: true,
        ...(setup.subtitle
            ? {
                  subtitle: {
                      ...setup.subtitle,
                      encoding: 'utf-8',
                      escape: true
                  },
                  settings: [
                      {
                          name: 'subtitleVisibility',
                          html: setup.subtitleVisibilityLabel,
                          switch: true,
                          mounted(_panel, item) {
                              const visible = this.storage.get(SUBTITLE_VISIBILITY_STORAGE_KEY) !== false;
                              item.switch = visible;
                              this.subtitle.show = visible;
                          },
                          onSwitch(item) {
                              const visible = !item.switch;
                              this.subtitle.show = visible;
                              this.storage.set(SUBTITLE_VISIBILITY_STORAGE_KEY, visible);
                              return visible;
                          }
                      }
                  ]
              }
            : {}),
        moreVideoAttr: { preload: setup.preload }
    });
}

function bindSubtitleOffset(player: Artplayer, instanceKey?: string) {
    const storageKey = `${SUBTITLE_OFFSET_STORAGE_PREFIX}${instanceKey ?? 'default'}`;
    player.on('subtitleLoad', () => {
        const storedOffset = player.storage.get(storageKey);
        if (typeof storedOffset === 'number' && Number.isFinite(storedOffset)) player.subtitleOffset = storedOffset;
    });
    player.on('subtitleOffset', (offset: number) => player.storage.set(storageKey, offset));
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
    const {
        autoPlay,
        containerRef,
        instanceKey,
        latestRef,
        loadedSourceRef,
        locale,
        loop,
        muted,
        preload,
        subtitle,
        subtitleVisibilityLabel
    } = setup;

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
                    preload,
                    subtitle,
                    subtitleVisibilityLabel
                });
                if (!instance) return;
                playerRef.current = instance;
                loadedSourceRef.current = latestRef.current.src;
                bindPlayerEvents(instance, latestRef, playbackToken);
                if (subtitle) bindSubtitleOffset(instance, instanceKey);
                unsubscribeExclusivePlayback = subscribeExclusiveVideoPlayback(playbackToken, () => {
                    if (instance && !instance.isDestroy && instance.playing) instance.pause();
                });
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
    }, [
        autoPlay,
        containerRef,
        instanceKey,
        latestRef,
        loadedSourceRef,
        locale,
        loop,
        muted,
        playbackToken,
        preload,
        subtitle,
        subtitleVisibilityLabel
    ]);

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
