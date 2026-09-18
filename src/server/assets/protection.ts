import 'server-only';

// Verified against the Xcity account page for demo@xcity.ai.
const DEMO_ASSET_OWNER_ID = 'd5f4d864-e07e-45c4-957f-795a724ac750';

function protectedUserIds(): Set<string> {
    return new Set(
        [DEMO_ASSET_OWNER_ID, ...(process.env.PROTECTED_ASSET_USER_IDS ?? '').split(',')]
            .map((id) => id.trim())
            .filter(Boolean)
    );
}

export function hasProtectedAssetUsers(): boolean {
    return protectedUserIds().size > 0;
}

export function isProtectedAssetUserId(userId: string): boolean {
    return protectedUserIds().has(userId);
}

export function isProtectedAssetSubject(subject: string): boolean {
    const userId = subject.match(/^xcity:(.+)$/)?.[1];
    return Boolean(userId && isProtectedAssetUserId(userId));
}

function gatewayBaseUrl(): string {
    return (
        process.env.XCITY_LITELLM_URL ||
        process.env.TOKENHUB_URL ||
        process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL ||
        'https://tokenhub.xcity.one'
    )
        .trim()
        .replace(/\/+$/, '')
        .replace(/\/v1$/, '');
}

export async function assetDeletionProtection(bearer: string): Promise<'allowed' | 'protected' | 'unavailable'> {
    if (!hasProtectedAssetUsers()) return 'allowed';
    try {
        const response = await fetch(`${gatewayBaseUrl()}/key/info`, {
            headers: { Authorization: `Bearer ${bearer}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) return 'unavailable';
        const body: unknown = await response.json();
        if (!body || typeof body !== 'object' || !('info' in body)) return 'unavailable';
        const info = body.info;
        if (!info || typeof info !== 'object' || !('user_id' in info) || typeof info.user_id !== 'string')
            return 'unavailable';
        return isProtectedAssetUserId(info.user_id) ? 'protected' : 'allowed';
    } catch {
        return 'unavailable';
    }
}
