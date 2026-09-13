import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectLegacy, LEGACY_OWNER_KEY } from '@/features/persistence/legacy';

function memoryStorage() {
    const storage: Record<string, unknown> = {};
    Object.defineProperties(storage, {
        getItem: { value: (key: string) => storage[key] ?? null },
        setItem: { value: (key: string, value: string) => { storage[key] = value; } },
        removeItem: { value: (key: string) => { delete storage[key]; } }
    });
    return storage as unknown as Storage;
}

describe('first-run cache validation', () => {
    beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

    it('imports only supported data and leaves original keys untouched', () => {
        localStorage.setItem('openaiApiKey', 'sk-private');
        localStorage.setItem('unrelated', JSON.stringify({ value: 1 }));
        localStorage.setItem('soraVideoCharacters', JSON.stringify([{ id: 'c1', name: 'Alice', url: 'asset://a' }]));
        const result = collectLegacy('account-a');
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0].data?.name).toBe('Alice');
        expect(localStorage.getItem('openaiApiKey')).toBe('sk-private');
        expect(localStorage.getItem('soraVideoCharacters')).not.toBeNull();
    });

    it('does not import one account cache into a later account', () => {
        localStorage.setItem(LEGACY_OWNER_KEY, 'account-a');
        localStorage.setItem('soraVideoCharacters', JSON.stringify([{ id: 'c1', name: 'Alice', url: 'asset://a' }]));
        expect(collectLegacy('account-b')).toEqual({ changes: [], invalid: [], eligible: false });
    });

    it('keeps malformed documents locally and reports their keys', () => {
        localStorage.setItem('xctStudioShortDramaProjects', '{broken');
        const result = collectLegacy('account-a');
        expect(result.invalid).toEqual(['xctStudioShortDramaProjects']);
        expect(localStorage.getItem('xctStudioShortDramaProjects')).toBe('{broken');
    });

    it('imports deletion tombstones instead of resurrecting local history', () => {
        localStorage.setItem('soraVideoHistory', JSON.stringify([{ id: 'old', prompt: 'Hi', model: 'test' }]));
        localStorage.setItem('soraVideoDeletedIds', JSON.stringify(['old']));
        expect(collectLegacy('account-a').changes.find((r) => r.table === 'generation_jobs' && r.id === 'old')?.data).toBeNull();
    });
});
