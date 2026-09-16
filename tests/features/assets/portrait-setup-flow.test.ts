import {
    clearPortraitVerificationResult,
    readPortraitVerificationResult,
    subscribePortraitVerificationResult,
    writePortraitVerificationResult
} from '@/features/assets/portrait/setup-flow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('portrait setup callback bridge', () => {
    const values = new Map<string, string>();
    const channels = new Set<TestBroadcastChannel>();

    class TestBroadcastChannel {
        onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
        constructor() {
            channels.add(this);
        }
        postMessage(data: unknown) {
            for (const channel of channels)
                if (channel !== this) channel.onmessage?.({ data } as MessageEvent<unknown>);
        }
        close() {
            channels.delete(this);
        }
    }

    beforeEach(() => {
        values.clear();
        channels.clear();
        vi.stubGlobal('window', {});
        vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
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

    it('notifies the Studio tab when Chrome blocks local storage writes', () => {
        const received: string[] = [];
        const unsubscribe = subscribePortraitVerificationResult((result) => received.push(result.groupId));
        vi.stubGlobal('localStorage', {
            getItem: () => null,
            setItem: () => {
                throw new Error('storage denied');
            }
        });

        writePortraitVerificationResult('group-456');

        expect(received).toEqual(['group-456']);
        unsubscribe();
        expect(channels.size).toBe(0);
    });
});
