'use client';

import { RateLimitError, verifyFrontendApiKey } from '@/lib/openai-client';
import { InvalidApiKeyError } from '@/shared/errors';
import { XCITY_SSO_ENABLED, fetchXcityUserKey } from '@/features/settings/sso';
import * as React from 'react';
import { XcityKeyContext } from '../key-context';

export type SsoStatus = 'checking' | 'ok' | 'unauthenticated' | 'error';

/** Kept under the historical name so existing users' saved keys survive. */
const STORAGE_KEY = 'openaiApiKey';

function getStoredApiKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
}

/**
 * Single owner of the TokenHub key: SSO fetch, manual entry, invalidation.
 *
 * `keyRef` is the always-current copy. Anything that runs outside the render
 * cycle (submit handlers, polling callbacks, archive reconciliation) must read
 * the key through it — or through `resolveKey`, which additionally retries the
 * SSO fetch when no key is on hand — never from captured state.
 */
export function useXcityKeyState() {
    // Starts null on both server and client — the stored key is picked up in
    // a mount effect. Reading localStorage in the initializer renders
    // different HTML on the server than on the client (hydration error).
    const [apiKey, setApiKeyState] = React.useState<string | null>(null);
    const keyRef = React.useRef<string | null>(null);

    const [ssoStatus, setSsoStatus] = React.useState<SsoStatus>(XCITY_SSO_ENABLED ? 'checking' : 'ok');
    const [ssoError, setSsoError] = React.useState<string | null>(null);

    const setKey = React.useCallback((key: string | null) => {
        keyRef.current = key;
        setApiKeyState(key);
    }, []);

    React.useEffect(() => {
        const stored = getStoredApiKey();
        if (stored && !keyRef.current) {
            setKey(stored);
        }
    }, [setKey]);

    const attemptSso = React.useCallback(async () => {
        setSsoStatus('checking');
        setSsoError(null);
        try {
            const result = await fetchXcityUserKey();
            if (result.status === 'ok') {
                setKey(result.key);
                setSsoStatus('ok');
                return;
            }
            setSsoStatus(result.status === 'unauthenticated' ? 'unauthenticated' : 'error');
            if (result.status === 'error') {
                setSsoError(result.message);
            }
        } catch {
            setSsoStatus('error');
        }
    }, [setKey]);

    React.useEffect(() => {
        if (XCITY_SSO_ENABLED) {
            void attemptSso();
        }
    }, [attemptSso]);

    /**
     * Call-time key resolution: when SSO is enabled, fetch a fresh SSO key
     * first because keys rotate and a manually stored key may be stale. Fall
     * back to the current/manual key only when SSO is unavailable.
     */
    const resolveKey = React.useCallback(async (): Promise<string | null> => {
        if (XCITY_SSO_ENABLED) {
            const result = await fetchXcityUserKey();
            if (result.status === 'ok') {
                setKey(result.key);
                setSsoStatus('ok');
                return result.key;
            }
            setSsoStatus(result.status === 'unauthenticated' ? 'unauthenticated' : 'error');
            if (result.status === 'error') {
                setSsoError(result.message);
            }
        }
        if (keyRef.current) return keyRef.current;
        return null;
    }, [setKey]);

    /** Validates and persists a manually entered key. Throws with a user-facing message. */
    const saveManualKey = React.useCallback(
        async (rawKey: string) => {
            const trimmedKey = rawKey.trim();

            if (!trimmedKey) {
                throw new Error('API key cannot be empty.');
            }
            if (!trimmedKey.startsWith('sk-')) {
                throw new Error('API key format looks incorrect. It should start with “sk-”.');
            }

            try {
                await verifyFrontendApiKey(trimmedKey, process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL);
            } catch (error) {
                if (error instanceof InvalidApiKeyError) {
                    throw new Error('The gateway rejected this API key. Please double-check and try again.');
                }
                if (error instanceof RateLimitError) {
                    throw new Error('This API key is rate-limited right now. Wait for the limit to reset or use a key with a higher RPM.');
                }
                console.error('Error verifying API key:', error);
                throw new Error('Failed to verify API key. Please try again.');
            }

            try {
                localStorage.setItem(STORAGE_KEY, trimmedKey);
            } catch (storageError) {
                console.error('Error saving API key:', storageError);
                throw new Error('Failed to persist API key. Please ensure storage is available.');
            }

            setKey(trimmedKey);
            setSsoStatus('ok');
        },
        [setKey]
    );

    /** Drops a rejected key so the next call can't reuse it. */
    const invalidateKey = React.useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
        setKey(null);
    }, [setKey]);

    return { apiKey, keyRef, ssoStatus, ssoError, attemptSso, resolveKey, saveManualKey, invalidateKey };
}

export function useXcityKey() {
    const context = React.useContext(XcityKeyContext);
    if (!context) throw new Error('Xcity key provider is required');
    return context;
}
