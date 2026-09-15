'use client';

import styles from './index.module.scss';
import { aspectRatioFromSize, VideoPlayer } from '@/components/ui/VideoPlayer';
import { captionCuesToSrt } from '@/features/post-production/captions/alignment';
import type { CaptionTrack } from '@/shared/contracts/video';
import * as React from 'react';

export type CompletedVideoPlayerProps = {
    jobId: string;
    videoSrc: string;
    size: string;
    thumbnailSrc?: string | null | undefined;
    captionTrack?: CaptionTrack;
    onSourceError?: () => void;
};

export function CompletedVideoPlayer({
    jobId,
    videoSrc,
    size,
    thumbnailSrc,
    captionTrack,
    onSourceError
}: CompletedVideoPlayerProps) {
    const subtitleSrt =
        captionTrack?.status === 'completed' && captionTrack.delivery === 'player'
            ? captionCuesToSrt(captionTrack.cues)
            : '';
    const subtitle = React.useMemo(
        () =>
            subtitleSrt
                ? { url: `data:text/plain;charset=utf-8,${encodeURIComponent(subtitleSrt)}`, type: 'srt' as const }
                : undefined,
        [subtitleSrt]
    );

    return (
        <VideoPlayer
            src={videoSrc}
            poster={thumbnailSrc}
            instanceKey={`${jobId}:${subtitle ? 'subtitles' : 'plain'}`}
            aspectRatio={aspectRatioFromSize(size)}
            className={styles.player}
            preload='auto'
            subtitle={subtitle}
            onSourceError={onSourceError}
        />
    );
}
