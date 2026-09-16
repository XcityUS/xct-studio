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

type PortraitVerificationResult = {
    groupId: string;
    completedAt: number;
};

export const PORTRAIT_VERIFICATION_RESULT_STORAGE_KEY = 'xctStudioPortraitVerificationResult';

export function readPortraitVerificationResult(): PortraitVerificationResult | null {
    if (typeof window === 'undefined') return null;
    try {
        const parsed = JSON.parse(localStorage.getItem(PORTRAIT_VERIFICATION_RESULT_STORAGE_KEY) ?? 'null') as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const value = parsed as Partial<PortraitVerificationResult>;
        if (typeof value.groupId !== 'string' || !value.groupId.trim() || typeof value.completedAt !== 'number') {
            return null;
        }
        return { groupId: value.groupId.trim(), completedAt: value.completedAt };
    } catch {
        return null;
    }
}

export function writePortraitVerificationResult(groupId: string): void {
    try {
        localStorage.setItem(
            PORTRAIT_VERIFICATION_RESULT_STORAGE_KEY,
            JSON.stringify({ groupId: groupId.trim(), completedAt: Date.now() } satisfies PortraitVerificationResult)
        );
    } catch {
        // Verification remains valid; the user can return to Assets and refresh manually.
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
