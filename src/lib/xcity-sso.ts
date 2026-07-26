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
 */

export const XCITY_SSO_ENABLED = process.env.NEXT_PUBLIC_XCITY_SSO === 'true';

const KEY_URL = process.env.NEXT_PUBLIC_XCITY_KEY_URL || 'https://xcity.ai/api/me/litellm-key';

export const XCITY_LOGIN_URL = process.env.NEXT_PUBLIC_XCITY_LOGIN_URL || 'https://xcity.ai/login';

export function xcityLoginHref(): string {
    if (typeof window === 'undefined') return XCITY_LOGIN_URL;
    return `${XCITY_LOGIN_URL}?return=${encodeURIComponent(window.location.href)}`;
}

/**
 * Last key handed out by the SSO fetch. React state is the source of truth for
 * rendering, but submit handlers capture state from the render they were bound
 * in — so a key that arrives after the form rendered is invisible to them. This
 * module-level copy is the escape hatch those handlers read.
 */
let lastKnownKey: string | null = null;

export function getLastKnownKey(): string | null {
    return lastKnownKey;
}

export function rememberKey(key: string | null): void {
    lastKnownKey = key;
}

export type XcityKeyFetch =
    | { status: 'ok'; key: string; plan?: string }
    | { status: 'unauthenticated' }
    | { status: 'error'; message: string };

export async function fetchXcityUserKey(): Promise<XcityKeyFetch> {
    try {
        const res = await fetch(KEY_URL, { credentials: 'include' });
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
        rememberKey(data.key);
        return { status: 'ok', key: data.key, plan: data.plan };
    } catch (err) {
        // Same-site fetch failing usually means CORS not yet allowing this
        // origin, or the user is on a non-xcity.ai preview domain (cookie
        // not sent cross-site).
        return { status: 'error', message: err instanceof Error ? err.message : 'network error' };
    }
}
