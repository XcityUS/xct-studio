import type { VideoMetadata } from '@/types/video';

export type MediaState = 'pending' | 'local' | 'archived' | 'provider' | 'expired';

export const PROVIDER_LINK_TTL_MS = 24 * 60 * 60 * 1000;

/** Best guess at when the provider finished: history stores creation + durationMs. */
export function completedAtMs(item: VideoMetadata): number {
    return item.timestamp + Math.max(0, item.durationMs || 0);
}

export function providerLinkLikelyDead(item: VideoMetadata, now: number): boolean {
    if (item.status !== 'completed' || item.storedUrl) return false;
    return now - completedAtMs(item) >= PROVIDER_LINK_TTL_MS;
}

export function resolveMediaState(
    item: VideoMetadata,
    sources: { hasBlob: boolean },
    now: number
): MediaState {
    if (sources.hasBlob) return 'local';
    if (item.storedUrl) return 'archived';
    if (item.status !== 'completed') return 'pending';
    if (item.mediaExpired || providerLinkLikelyDead(item, now)) return 'expired';
    // Inside the 24 h window the provider link is presumed usable even before
    // this session has resolved one (selection resolves it on demand).
    return 'provider';
}
