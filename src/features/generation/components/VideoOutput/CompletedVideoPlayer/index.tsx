'use client';

import styles from './index.module.scss';
import { aspectRatioFromSize, VideoPlayer } from '@/components/ui/VideoPlayer';

export type CompletedVideoPlayerProps = {
    jobId: string;
    videoSrc: string;
    size: string;
    thumbnailSrc?: string | null | undefined;
    onSourceError?: () => void;
};

export function CompletedVideoPlayer({
    jobId,
    videoSrc,
    size,
    thumbnailSrc,
    onSourceError
}: CompletedVideoPlayerProps) {
    return (
        <VideoPlayer
            src={videoSrc}
            poster={thumbnailSrc}
            instanceKey={jobId}
            aspectRatio={aspectRatioFromSize(size)}
            className={styles.player}
            preload='auto'
            onSourceError={onSourceError}
        />
    );
}
