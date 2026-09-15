'use client';

import { useLatestPlayerProps, usePlayerInstance, usePlayerPoster, usePlayerSource } from './hooks';
import styles from './index.module.scss';
import type { VideoPlayerProps } from './types';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

export type { VideoPlayerProps } from './types';

export function aspectRatioFromSize(size: string): string {
    const match = size.match(/(\d+)\s*[:xX]\s*(\d+)/);
    if (!match) return '16 / 9';

    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return '16 / 9';
    return `${width} / ${height}`;
}

export function VideoPlayer({
    src,
    poster,
    instanceKey,
    aspectRatio,
    className,
    title,
    autoPlay = false,
    loop = false,
    muted = false,
    preload = 'metadata',
    subtitle,
    onDurationChange,
    onSourceError
}: VideoPlayerProps) {
    const locale = useLocale();
    const t = useTranslations();
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const loadedSourceRef = React.useRef<string | null>(null);
    const latestRef = useLatestPlayerProps({ src, poster, onDurationChange, onSourceError });
    const playerRef = usePlayerInstance({
        containerRef,
        latestRef,
        loadedSourceRef,
        locale,
        autoPlay,
        loop,
        muted,
        preload,
        subtitle,
        subtitleVisibilityLabel: t('Show subtitles'),
        instanceKey
    });

    usePlayerSource(playerRef, loadedSourceRef, latestRef, src);
    usePlayerPoster(playerRef, poster);

    return (
        <div
            ref={containerRef}
            className={`${styles.player}${className ? ` ${className}` : ''}`}
            style={aspectRatio ? { aspectRatio } : undefined}
            data-player='artplayer'
            aria-label={t('Video player')}
            title={title}
        />
    );
}
