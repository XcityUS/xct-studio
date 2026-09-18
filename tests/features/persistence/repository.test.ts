import { writeBusinessRecords } from '@/server/persistence/repository';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
const release = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/server/database/pool', () => ({
    readyDatabase: async () => ({ connect: async () => ({ query, release }) })
}));

const change = { table: 'projects' as const, scope: 'projects', id: 'p', data: { title: 'Local' }, baseRevision: 0 };

afterEach(() => vi.unstubAllEnvs());

describe('owner-scoped database transactions', () => {
    beforeEach(() => {
        query.mockReset();
        release.mockClear();
        query.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('never overwrites an existing record during first-run import', async () => {
        query.mockImplementation(async (sql: string) => ({
            rows: sql.includes('pg_try_advisory') ? [{ acquired: true }] : sql.includes('WITH incoming')
                ? [{ scope: 'projects', id: 'p', data: { title: 'Cloud' }, revision: 7 }]
                : []
        }));
        const result = await writeBusinessRecords('owner-a', { mode: 'import', changes: [change] });
        expect(result.records[0].data).toEqual({ title: 'Cloud' });
        expect(query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT INTO projects'))).toBe(false);
        expect(query.mock.calls.find(([sql]) => String(sql).includes('WITH incoming'))?.[1]).toEqual([
            'owner-a',
            JSON.stringify([{ scope: 'projects', id: 'p', data: change.data }])
        ]);
    });

    it('rejects asset tombstones for a protected account before writing records', async () => {
        vi.stubEnv('PROTECTED_ASSET_USER_IDS', 'demo-id');
        query.mockImplementation(async (sql: string) => ({
            rows: sql.includes('pg_try_advisory')
                ? [{ acquired: true }]
                : sql.includes('SELECT external_subject')
                  ? [{ external_subject: 'xcity:demo-id' }]
                  : []
        }));

        await expect(writeBusinessRecords('owner-a', {
            mode: 'write',
            changes: [{ table: 'media_assets', scope: 'r2', id: 'photo', data: null, baseRevision: 1 }]
        })).rejects.toMatchObject({ code: 'ASSET_DELETE_PROTECTED', status: 403 });
        expect(query.mock.calls.some(([sql]) => String(sql).includes('WITH incoming'))).toBe(false);
        expect(query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('does not resurrect a deleted record from an old cache', async () => {
        query.mockImplementation(async (sql: string) => ({
            rows: sql.includes('pg_try_advisory') ? [{ acquired: true }] : sql.includes('WITH incoming') ? [{ scope: 'projects', id: 'p', data: null, revision: 3 }] : []
        }));
        const result = await writeBusinessRecords('owner-a', { mode: 'import', changes: [change] });
        expect(result.records[0].data).toBeNull();
    });

    it('rejects stale edits and rolls the transaction back', async () => {
        query.mockImplementation(async (sql: string) => ({
            rows: sql.includes('pg_try_advisory') ? [{ acquired: true }] : sql.startsWith('SELECT existing')
                ? [{ scope: 'projects', id: 'p', data: { title: 'Remote' }, revision: 3 }]
                : []
        }));
        const result = await writeBusinessRecords('owner-a', { mode: 'write', changes: [change] });
        expect(result.conflicts).toHaveLength(1);
        expect(result.records).toEqual([]);
        expect(query).toHaveBeenCalledWith('ROLLBACK');
        expect(query).not.toHaveBeenCalledWith('COMMIT');
        expect(release).toHaveBeenCalled();
    });

    it('recognizes an acknowledged retry independent of JSON property order', async () => {
        query.mockImplementation(async (sql: string) => ({
            rows: sql.includes('pg_try_advisory') ? [{ acquired: true }] : sql.startsWith('SELECT existing')
                ? [{ scope: 'projects', id: 'p', data: { genre: 'Drama', title: 'Local' }, revision: 3 }]
                : []
        }));
        const result = await writeBusinessRecords('owner-a', {
            mode: 'write',
            changes: [{ ...change, data: { title: 'Local', genre: 'Drama' } }]
        });
        expect(result.conflicts).toEqual([]);
    });

    it('releases a busy transaction without attempting a write', async () => {
        await expect(writeBusinessRecords('owner-a', { mode: 'write', changes: [change] })).rejects.toThrow('DATABASE_BUSY');
        expect(query).toHaveBeenCalledWith('ROLLBACK');
        expect(release).toHaveBeenCalledOnce();
        expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false);
    });

    it('adopts newer inventory metadata while retaining user-edit conflict protection', async () => {
        query.mockImplementation(async (sql: string) => ({
            rows: sql.includes('pg_try_advisory') ? [{ acquired: true }] : sql.startsWith('SELECT existing')
                ? [{ scope: 'provider', id: 'asset-1', data: { status: 'Active' }, revision: 4 }] : []
        }));
        const result = await writeBusinessRecords('owner-a', { mode: 'write', changes: [{
            table: 'provider_assets', scope: 'provider', id: 'asset-1', data: { status: 'Processing' }, baseRevision: 1
        }] });
        expect(result.conflicts).toEqual([]);
        expect(result.records[0].data).toEqual({ status: 'Active' });
        expect(result.records[0].revision).toBe(4);
        expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false);
    });

    it('rejects a stale explicit inventory deletion', async () => {
        query.mockImplementation(async (sql: string) => ({
            rows: sql.includes('pg_try_advisory') ? [{ acquired: true }] : sql.includes('SELECT external_subject')
                ? [{ external_subject: 'xcity:another-user' }] : sql.startsWith('SELECT existing')
                  ? [{ scope: 'provider', id: 'asset-1', data: { status: 'Active' }, revision: 4 }] : []
        }));
        const result = await writeBusinessRecords('owner-a', { mode: 'write', changes: [{
            table: 'provider_assets', scope: 'provider', id: 'asset-1', data: null, baseRevision: 1
        }] });
        expect(result.records).toEqual([]);
        expect(result.conflicts).toHaveLength(1);
        expect(query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('keeps completed media archives instead of reverting to an expired source', async () => {
        query.mockImplementation(async (sql: string) => ({ rows: sql.includes('pg_try_advisory') ? [{ acquired: true }]
            : sql.startsWith('SELECT existing') ? [{ scope: 'images', id: 'image-1', revision: 4,
                data: { prompt: 'Fixture', source_url: 'https://media.example/media/fixture.png', archivePending: false } }] : [] }));
        const result = await writeBusinessRecords('owner-a', { mode: 'write', changes: [{
            table: 'media_assets', scope: 'images', id: 'image-1', baseRevision: 1,
            data: { prompt: 'Fixture', source_url: 'https://provider.example/expired.png', archivePending: true }
        }] });
        expect(result.conflicts).toEqual([]);
        expect(result.records[0].data?.archivePending).toBe(false);
        expect(result.records[0].revision).toBe(4);
    });
});
