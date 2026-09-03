/**
 * Xcity unified-key SSO.
 *
 * Users sign in once at xcity.ai; every sub-product (chat, agent-desktop,
 * this studio) consumes the same per-user TokenHub virtual key via
 * GET /api/me/litellm-key. studio.xcity.ai is same-site with xcity.ai, so
 * the session cookie rides along on a credentialed fetch and the gateway
 * then bills the user's own plan/budget — no shared key on this server.
 *
 * Enabled per deployment with NEXT_PUBLIC_XCITY_SSO=true (requires the
 * xcity.ai CORS allowlist to include this origin).
 *
 * Key lifetime is handled by useXcityKey (src/hooks/use-xcity-key.ts), which
 * keeps an always-current ref so submit/poll/archive paths never act on a key
 * captured by a stale render.
 */

export const XCITY_SSO_ENABLED = process.env.NEXT_PUBLIC_XCITY_SSO === 'true';

const KEY_URL = process.env.NEXT_PUBLIC_XCITY_KEY_URL || 'https://xcity.ai/api/me/litellm-key';
const KEY_FETCH_TIMEOUT_MS = 15_000;

export const XCITY_LOGIN_URL = process.env.NEXT_PUBLIC_XCITY_LOGIN_URL || 'https://xcity.ai/login';

export function xcityLoginHref(): string {
    if (typeof window === 'undefined') return XCITY_LOGIN_URL;
    return `${XCITY_LOGIN_URL}?return=${encodeURIComponent(window.location.href)}`;
}

export type XcityKeyFetch =
    | { status: 'ok'; key: string; plan?: string }
    | { status: 'unauthenticated' }
    | { status: 'error'; message: string };

export async function fetchXcityUserKey(): Promise<XcityKeyFetch> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), KEY_FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(KEY_URL, { credentials: 'include', signal: controller.signal });
        if (res.status === 401) {
            return { status: 'unauthenticated' };
        }
        if (!res.ok) {
            return { status: 'error', message: `key endpoint returned ${res.status}` };
        }
        const data = (await res.json()) as { key?: string; plan?: string };
        if (!data.key) {
            return { status: 'error', message: 'key endpoint returned no key' };
        }
        return { status: 'ok', key: data.key, plan: data.plan };
    } catch (err) {
        // Same-site fetch failing usually means CORS not yet allowing this
        // origin, or the user is on a non-xcity.ai preview domain (cookie
        // not sent cross-site).
        if (err instanceof DOMException && err.name === 'AbortError') {
            return { status: 'error', message: 'key request timed out' };
        }
        return { status: 'error', message: err instanceof Error ? err.message : 'network error' };
    } finally {
        window.clearTimeout(timeoutId);
    }
}
