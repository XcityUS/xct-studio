import { readyDatabase } from '@/server/database/pool';
import { BusinessError } from './auth';
import { importMissingRecords } from './import';
import { writeRecordBatches } from './write';
import { TABLES } from '@/server/database/schema';
import {
    type BusinessRecord,
    type BusinessWrite,
    type BusinessWriteResult
} from '@/shared/contracts/business-data';
import { createHash } from 'node:crypto';
import 'server-only';

export type BusinessCursor = Pick<BusinessRecord, 'table' | 'scope' | 'id'>;

export async function readBusinessRecords(owner: string, after?: BusinessCursor): Promise<BusinessRecord[]> {
    const pool = await readyDatabase();
    const sql = TABLES.map(
        (table) => `SELECT '${table}' AS "table", scope, id, data, revision
        FROM ${table} WHERE owner_id = $1`
    ).join(' UNION ALL ');
    const result = await pool.query<BusinessRecord>(
        `SELECT * FROM (${sql}) snapshot
        WHERE $2::text IS NULL OR ("table", scope, id) > ($2::text, $3::text, $4::text)
        ORDER BY "table", scope, id LIMIT 250`,
        [owner, after?.table ?? null, after?.scope ?? null, after?.id ?? null]
    );
    return result.rows;
}

export async function writeBusinessRecords(owner: string, input: BusinessWrite): Promise<BusinessWriteResult> {
    const client = await (await readyDatabase()).connect();
    let result: BusinessWriteResult;
    try {
        await client.query('BEGIN');
        const lock = await client.query<{ acquired: boolean }>(
            'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired', [owner]
        );
        if (!lock.rows[0]?.acquired) throw new BusinessError('DATABASE_BUSY', 503);
        if (input.mode === 'import') {
            result = { records: await importMissingRecords(client, owner, input.changes), conflicts: [] };
        } else {
            result = await writeRecordBatches(client, owner, input.changes);
        }
        if (result.conflicts.length) {
            const tables: Record<string, number> = {};
            for (const key of result.conflicts) {
                const [table] = JSON.parse(key) as string[];
                tables[table] = (tables[table] ?? 0) + 1;
            }
            console.info('[business-data] Revision conflict', { tables });
            await client.query('ROLLBACK');
            return { records: [], conflicts: result.conflicts };
        }
        if (input.mode === 'import') {
            const hash = createHash('sha256').update(JSON.stringify(input.changes)).digest('hex');
            await client.query(
                `INSERT INTO data_imports(owner_id, fingerprint, record_count) VALUES ($1,$2,$3)
                ON CONFLICT DO NOTHING`,
                [owner, hash, input.changes.length]
            );
        }
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
