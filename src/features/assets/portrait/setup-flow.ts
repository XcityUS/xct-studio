export type PortraitSetupRequest = {
    origin: 'real-person';
    referenceKey: string;
    requestedAt: number;
    sourceUrl: string;
};

export type PortraitSetupCompletion = PortraitSetupRequest & {
    assetId: string;
    groupId: string;
};

export type PortraitVerificationResult = {
    groupId: string;
    completedAt: number;
};

export const PORTRAIT_VERIFICATION_RESULT_STORAGE_KEY = 'xctStudioPortraitVerificationResult';
const PORTRAIT_VERIFICATION_CHANNEL = 'xctStudioPortraitVerification';

function parsePortraitVerificationResult(value: unknown): PortraitVerificationResult | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const result = value as Partial<PortraitVerificationResult>;
    if (typeof result.groupId !== 'string' || !result.groupId.trim() || typeof result.completedAt !== 'number') {
        return null;
    }
    return { groupId: result.groupId.trim(), completedAt: result.completedAt };
}

export function readPortraitVerificationResult(): PortraitVerificationResult | null {
    if (typeof window === 'undefined') return null;
    try {
        const parsed = JSON.parse(localStorage.getItem(PORTRAIT_VERIFICATION_RESULT_STORAGE_KEY) ?? 'null') as unknown;
        return parsePortraitVerificationResult(parsed);
    } catch {
        return null;
    }
}

export function writePortraitVerificationResult(groupId: string): void {
    const result = { groupId: groupId.trim(), completedAt: Date.now() } satisfies PortraitVerificationResult;
    try {
        localStorage.setItem(PORTRAIT_VERIFICATION_RESULT_STORAGE_KEY, JSON.stringify(result));
    } catch {
        // Browser storage may be restricted; the same-origin channel can still notify the open Studio tab.
    }
    try {
        if (typeof BroadcastChannel === 'undefined') return;
        const channel = new BroadcastChannel(PORTRAIT_VERIFICATION_CHANNEL);
        channel.postMessage(result);
        channel.close();
    } catch {
        // The storage event and focus listener remain available when the channel is blocked.
    }
}

export function subscribePortraitVerificationResult(
    onResult: (result: PortraitVerificationResult) => void
): () => void {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return () => undefined;
    try {
        const channel = new BroadcastChannel(PORTRAIT_VERIFICATION_CHANNEL);
        channel.onmessage = (event: MessageEvent<unknown>) => {
            const result = parsePortraitVerificationResult(event.data);
            if (result) onResult(result);
        };
        return () => channel.close();
    } catch {
        return () => undefined;
    }
}

export function clearPortraitVerificationResult(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(PORTRAIT_VERIFICATION_RESULT_STORAGE_KEY);
    } catch {
        // Storage is best-effort; a new verification result overwrites stale state.
    }
}
