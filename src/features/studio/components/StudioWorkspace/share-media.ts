import { mediaKeyFromUrl } from '@/lib/media-archive';

const hostedVideoKey = /^(?:u|k)\/[^/]+\/.+\.(?:mp4|mov|webm)$/i;

export class HostedShareMediaError extends Error {
    constructor(readonly reason: 'not-archived' | 'unavailable') {
        super(reason);
        this.name = 'HostedShareMediaError';
    }
}

/** Old Worker domains may still be stored in history; shares must use the current host. */
export async function hostedShareVideoUrl(storedUrl: string, workerBase: string): Promise<string> {
    const key = mediaKeyFromUrl(storedUrl);
    const segments = key?.split('/') ?? [];
    if (
        !workerBase ||
        !key ||
        !hostedVideoKey.test(key) ||
        segments.some((segment) => !segment || segment === '.' || segment === '..' || /[?#\\]/.test(segment))
    ) {
        throw new HostedShareMediaError('not-archived');
    }

    const worker = new URL(workerBase);
    const currentUrl = `${worker.origin}/media/${key}`;
    let available = false;
    try {
        const response = await fetch(currentUrl, { method: 'HEAD', redirect: 'error' });
        available = response.ok;
    } catch {
        // The same actionable message covers a missing object and an unreachable Worker.
    }
    if (!available) {
        throw new HostedShareMediaError('unavailable');
    }
    return currentUrl;
}
