import type { CaptionSegment } from '@/lib/captions';
import type { UserAsset } from '@/lib/media-archive';
import type { VideoJob, VideoMetadata } from '@/shared/contracts/video';

export type VideoHistoryPanelProps = {
    history: VideoMetadata[];
    activeJobs?: Map<string, VideoJob>;
    onSelectVideo: (item: VideoMetadata) => void;
    onClearHistory: () => void;
    getVideoSrc: (id: string) => string | undefined;
    getThumbnailSrc?: (id: string) => string | undefined;
    hasLocalCopy: (id: string) => boolean;
    onDeleteItem?: (item: VideoMetadata) => void;
    /** 做同款 — fill the create form with this item's parameters. */
    onReuseItem?: (item: VideoMetadata) => void;
    /** 重新生成 — resubmit this item's parameters as a new job. */
    onRegenerateItem?: (item: VideoMetadata) => void;
    /** Finalize — rerun this draft at its selected final resolution. */
    onFinalizeItem?: (item: VideoMetadata) => void;
    /** 续片 — continue this completed video from its last frame. */
    onExtendItem?: (item: VideoMetadata) => void;
    /** Items currently preparing their last frame for Extend. */
    extendPendingIds?: Set<string>;
    /** Share — create a public share page for this completed video. */
    onShareItem?: (item: VideoMetadata) => void;
    /** Adds the Studio branding watermark to an already completed video. */
    onAddWatermark?: (item: VideoMetadata, text?: string) => void | Promise<void>;
    /** Switches a watermarked item back to its original unwatermarked video. */
    onRemoveWatermark?: (item: VideoMetadata) => void | Promise<void>;
    /** Rename the display title shown on a history tile. */
    onRenameItem?: (item: VideoMetadata, title: string) => void;
    /** Retry permanent R2 archival for a completed item. */
    onRetryArchive?: (id: string) => void | Promise<void>;
    archivePendingIds?: Set<string>;
    sharePendingId?: string | null;
    watermarkPendingIds?: Set<string>;
    watermarkActiveId?: string | null;
    /** Fetches user audio assets for the assembly editor's BGM picker. */
    loadAudioAssets?: () => Promise<UserAsset[]>;
    /** Transcribes an assembled film for the assembly editor's captions flow. */
    onTranscribeVideo?: (blob: Blob) => Promise<CaptionSegment[]>;
};

export type StatusFilter = 'all' | 'completed' | 'processing' | 'archiving' | 'failed';
