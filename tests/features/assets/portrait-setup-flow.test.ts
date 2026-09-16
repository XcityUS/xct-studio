import {
    clearPortraitVerificationResult,
    readPortraitVerificationResult,
    writePortraitVerificationResult
} from '@/features/assets/portrait/setup-flow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('portrait setup callback bridge', () => {
    const values = new Map<string, string>();

    beforeEach(() => {
        values.clear();
        vi.stubGlobal('window', {});
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => values.get(key) ?? null,
            removeItem: (key: string) => values.delete(key),
            setItem: (key: string, value: string) => values.set(key, value)
        });
    });

    afterEach(() => vi.unstubAllGlobals());

    it('shares a successful verification group and clears it after binding', () => {
        writePortraitVerificationResult(' group-123 ');

        expect(readPortraitVerificationResult()).toMatchObject({ groupId: 'group-123' });
        clearPortraitVerificationResult();
        expect(readPortraitVerificationResult()).toBeNull();
    });

    it('ignores malformed callback state', () => {
        localStorage.setItem('xctStudioPortraitVerificationResult', JSON.stringify({ groupId: '' }));
        expect(readPortraitVerificationResult()).toBeNull();
    });
});
