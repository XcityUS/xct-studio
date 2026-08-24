import type { VideoMetadata } from '@/types/video';

export type MediaState = 'pending' | 'local' | 'archived' | 'provider' | 'expired';

export const PROVIDER_LINK_TTL_MS = 24 * 60 * 60 * 1000;

function parseTosDate(value: string | null): number | null {
    if (!value) return null;
    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;
    const timestamp = Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
    );
    return Number.isFinite(timestamp) ? timestamp : null;
}

export function providerUrlExpiresAtMs(providerUrl?: string): number | null {
    if (!providerUrl) return null;
    try {
        const parsed = new URL(providerUrl);
        const issuedAt = parseTosDate(parsed.searchParams.get('X-Tos-Date'));
        const expiresSeconds = Number(parsed.searchParams.get('X-Tos-Expires'));
        if (!issuedAt || !Number.isFinite(expiresSeconds) || expiresSeconds <= 0) return null;
        return issuedAt + expiresSeconds * 1000;
    } catch {
        return null;
    }
}

export function providerUrlExpired(providerUrl: string | undefined, now: number): boolean {
    const expiresAt = providerUrlExpiresAtMs(providerUrl);
    return expiresAt !== null && now >= expiresAt;
}

/** Best guess at when the provider finished: history stores creation + durationMs. */
export function completedAtMs(item: VideoMetadata): number {
    return item.timestamp + Math.max(0, item.durationMs || 0);
}

export function providerLinkLikelyDead(item: VideoMetadata, now: number): boolean {
    if (item.status !== 'completed' || item.storedUrl) return false;
    if (providerUrlExpired(item.providerUrl, now)) return true;
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
