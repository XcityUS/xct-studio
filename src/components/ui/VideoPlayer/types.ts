export type VideoPlayerProps = {
    src: string;
    poster?: string | null;
    instanceKey?: string;
    aspectRatio?: string;
    className?: string;
    title?: string;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    preload?: 'none' | 'metadata' | 'auto';
    onDurationChange?: (duration: number) => void;
    onSourceError?: () => void;
};

export type PlayerCallbacks = Pick<VideoPlayerProps, 'onDurationChange' | 'onSourceError' | 'poster' | 'src'>;

export type PlayerBehavior = Required<Pick<VideoPlayerProps, 'autoPlay' | 'loop' | 'muted' | 'preload'>> & {
    instanceKey?: string;
};
