import type { VideoMetadata } from '@/shared/contracts/video';

export type StudioTab = 'video' | 'image' | 'assets' | 'community';

export type AuthorizationTarget = {
    key: string;
    label: string;
    url: string;
    kind?: 'image' | 'video';
    authorizationId?: string;
};

export type WatermarkQueueItem = { item: VideoMetadata; text?: string };

export type SocialShareTarget = {
    id: string;
    label: string;
    url: (shareUrl: string) => string;
    copyFirst?: boolean;
};

/** Where a message belongs, so it lands next to the control that raised it. */
export type ErrorScope = 'create' | 'output';
