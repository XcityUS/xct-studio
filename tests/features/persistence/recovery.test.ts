import {
    listRecoveryCopies,
    preserveConflictOutboxes,
    readRecoveryCopy,
    recoveryCopiesSnapshot
} from '@/features/persistence/recovery';
import type { BusinessChange } from '@/shared/contracts/business-data';
import { afterEach, describe, expect, it, vi } from 'vitest';

function memoryStorage(): Storage {
    const values: Record<string, string> = {};
    return Object.assign(values, {
        getItem: (name: string) => values[name] ?? null,
        setItem: (name: string, value: string) => {
            values[name] = value;
        },
        removeItem: (name: string) => {
            delete values[name];
        }
    }) as unknown as Storage;
}

const change: BusinessChange = {
    table: 'projects',
    scope: 'projects',
    id: 'project-1',
    data: { title: 'Local edit' },
    baseRevision: 2
};

describe('automatic conflict recovery', () => {
    afterEach(() => vi.restoreAllMocks());

    it('backs up every local outbox before discarding stale edits', () => {
        const storage = memoryStorage();
        storage.setItem('xctStudioPending:owner-1', 'legacy');
        storage.setItem('xctStudioPending:v2:owner-1:tab-a', 'tab-a');
        storage.setItem('xctStudioPending:v2:owner-1:tab-b', 'tab-b');
        storage.setItem('xctStudioPending:v2:owner-2:tab-c', 'other account');

        const recoveryKey = preserveConflictOutboxes('owner-1', [change], storage);
        const backup = JSON.parse(storage.getItem(recoveryKey) ?? '') as {
            changes: BusinessChange[];
            outboxes: { name: string; raw: string }[];
        };

        expect(backup.changes).toEqual([change]);
        expect(backup.outboxes).toHaveLength(3);
        expect(backup.outboxes.map((item) => item.raw)).toEqual(['legacy', 'tab-a', 'tab-b']);
        expect(storage.getItem('xctStudioPending:v2:owner-1:tab-a')).toBeNull();
        expect(storage.getItem('xctStudioPending:v2:owner-2:tab-c')).toBe('other account');
    });

    it('keeps all pending edits when the recovery backup cannot be written', () => {
        const storage = memoryStorage();
        storage.setItem('xctStudioPending:v2:owner-1:tab-a', 'pending');
        const setItem = storage.setItem.bind(storage);
        vi.spyOn(storage, 'setItem').mockImplementation((name, value) => {
            if (name.includes(':recovery:')) throw new Error('storage full');
            setItem(name, value);
        });

        expect(() => preserveConflictOutboxes('owner-1', [change], storage)).toThrow('storage full');
        expect(storage.getItem('xctStudioPending:v2:owner-1:tab-a')).toBe('pending');
    });

    it('lists only the signed-in owner copies and keeps malformed copies downloadable', () => {
        const storage = memoryStorage();
        const older = 'xctStudioPending:owner-1:recovery:1000';
        const newer = 'xctStudioPending:owner-1:recovery:2000:copy';
        const other = 'xctStudioPending:owner-2:recovery:3000:copy';
        storage.setItem(older, JSON.stringify([change]));
        storage.setItem(newer, '{bad json');
        storage.setItem(other, JSON.stringify([change]));

        expect(listRecoveryCopies('owner-1', storage)).toEqual([
            { key: newer, createdAt: 2000, changeCount: 0 },
            { key: older, createdAt: 1000, changeCount: 1 }
        ]);
        expect(recoveryCopiesSnapshot('owner-1', storage)).not.toContain(other);
        expect(readRecoveryCopy('owner-1', newer, storage)).toBe('{bad json');
        expect(readRecoveryCopy('owner-1', other, storage)).toBeNull();
    });
});
