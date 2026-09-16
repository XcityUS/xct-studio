import type { VideoJob, VideoMetadata } from '@/shared/contracts/video';

export type VideoOutputProps = {
    job: VideoJob | null;
    videoSrc: string | null | undefined;
    thumbnailSrc?: string | null | undefined;
    mediaExpired?: boolean;
    isLoading: boolean;
    onSendToRemix?: (videoId: string) => void;
    onDownload?: (videoId: string) => void;
    onExtend?: (videoId: string) => void;
    isExtendPending?: boolean;
    onFinalize?: (videoId: string) => void;
    finalizeDisabledReason?: string;
    onShare?: (item: VideoMetadata) => void;
    shareItem?: VideoMetadata;
    isSharePending?: boolean;
    onSyncCaptions?: (videoId: string) => void;
    isCaptionSyncPending?: boolean;
    /** The gateway has no playable link for this completed job (yet). */
    previewUnavailable?: boolean;
    /** A completed job is still being probed for a playable source. */
    isPreviewResolving?: boolean;
    /** Re-resolves a playback source for the current job. */
    onRetryPreview?: () => void;
    /** Message for an action taken from this panel — rendered under the buttons. */
    error?: string | null;
};
