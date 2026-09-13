import { importMissingRecords } from '@/server/persistence/import';
import { writeRecordBatches } from '@/server/persistence/write';
import type { BusinessChange } from '@/shared/contracts/business-data';
import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Explicit opt-in only. Temporary tables shadow public tables; nothing is committed.
describe.skipIf(!process.env.TEST_DATABASE_URL)('real PostgreSQL batch semantics', () => {
    it('preserves owners, revisions, tombstones and idempotent batch acknowledgements', async () => {
        const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1, connectionTimeoutMillis: 8000 });
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('CREATE TEMP TABLE projects (LIKE public.projects INCLUDING ALL) ON COMMIT DROP');
            await client.query('CREATE TEMP TABLE business_revisions (LIKE public.business_revisions INCLUDING ALL) ON COMMIT DROP');
            const owner = '00000000-0000-4000-8000-000000000001';
            const other = '00000000-0000-4000-8000-000000000002';
            const changes: BusinessChange[] = Array.from({ length: 150 }, (_, id) => ({
                table: 'projects', scope: 'projects', id: String(id), data: { title: `Fixture ${id}` }, baseRevision: 0
            }));
            const inserted = await importMissingRecords(client, owner, changes);
            expect(inserted).toHaveLength(150);
            expect(inserted.every((r) => r.revision === 1)).toBe(true);
            const retry = await writeRecordBatches(client, owner, changes);
            expect(retry.conflicts).toEqual([]);
            expect(retry.records.every((r) => r.revision === 1)).toBe(true);
            const updated = await writeRecordBatches(client, owner, [{ ...changes[0], data: { title: 'Edited' }, baseRevision: 1 }]);
            expect(updated.records[0].revision).toBe(2);
            const conflict = await writeRecordBatches(client, owner, [{ ...changes[0], data: { title: 'Stale' }, baseRevision: 1 }]);
            expect(conflict.conflicts).toHaveLength(1);
            await writeRecordBatches(client, owner, [{ ...changes[0], data: null, baseRevision: 2 }]);
            const imported = await importMissingRecords(client, owner, [changes[0]]);
            expect(imported[0].data).toBeNull();
            expect(imported[0].revision).toBe(3);
            const isolated = await importMissingRecords(client, other, [changes[0]]);
            expect(isolated[0].data).toEqual(changes[0].data);
            const history = await client.query('SELECT revision FROM business_revisions ORDER BY revision');
            expect(history.rows.map((r) => r.revision)).toEqual([1, 2]);
        } finally {
            await client.query('ROLLBACK');
            client.release();
            await pool.end();
        }
    }, 60000);
});
