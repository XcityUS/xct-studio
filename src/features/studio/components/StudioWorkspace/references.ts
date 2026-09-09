export async function fetchVideoContentLength(url: string): Promise<number | null> {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) return null;
        const bytes = Number(res.headers.get('content-length'));
        return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
    } catch {
        return null;
    }
}

export function summarizeWebUrl(url?: string | null): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return url;
    }
}

export function isWebReferenceUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export function isReferenceVideoDownloadError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /video_url|reference_video/i.test(message) && /resource download failed|download/i.test(message);
}

export function referenceVideoDownloadErrorMessage(): string {
    return [
        'Studio could not download the draft video used for Finalize.',
        'The provider link may have expired, or the archived copy is not reachable yet.',
        'Reopen the completed draft after it finishes archiving, or regenerate the draft and try Finalize again.'
    ].join(' ');
}
