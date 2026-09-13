import { TABLES } from '@/server/database/schema';
import { recordKey, type BusinessChange, type BusinessRecord, type BusinessTable } from '@/shared/contracts/business-data';
import type { PoolClient } from 'pg';
import 'server-only';

/** Runs within the caller's transaction and owner lock. Existing rows, including tombstones, win. */
export async function importMissingRecords(
    client: PoolClient,
    owner: string,
    changes: BusinessChange[]
): Promise<BusinessRecord[]> {
    const groups = new Map<BusinessTable, Map<string, BusinessChange>>();
    for (const change of changes) {
        if (!TABLES.includes(change.table)) throw new Error('INVALID_TABLE');
        let group = groups.get(change.table);
        if (!group) {
            group = new Map();
            groups.set(change.table, group);
        }
        // Preserve the original import's first-record-wins behavior for duplicate ids.
        if (!group.has(recordKey(change))) group.set(recordKey(change), change);
    }
    const records = new Map<string, BusinessRecord>();
    for (const [table, group] of groups) {
        const input = [...group.values()].map(({ scope, id, data }) => ({ scope, id, data }));
        const result = await client.query<Omit<BusinessRecord, 'table'>>(
            `WITH incoming AS (
                SELECT scope, id, NULLIF(data, 'null'::jsonb) AS data
                FROM jsonb_to_recordset($2::jsonb) AS item(scope text, id text, data jsonb)
            ), inserted AS (
                INSERT INTO ${table}(owner_id, scope, id, data, deleted_at)
                SELECT $1::uuid, scope, id, data, CASE WHEN data IS NULL THEN now() ELSE NULL END
                FROM incoming
                ON CONFLICT(owner_id, scope, id) DO NOTHING
                RETURNING scope, id, data, revision
            )
            SELECT scope, id, data, revision FROM inserted
            UNION ALL
            SELECT existing.scope, existing.id, existing.data, existing.revision
            FROM ${table} existing
            JOIN incoming ON incoming.scope = existing.scope AND incoming.id = existing.id
            WHERE existing.owner_id = $1::uuid
            AND NOT EXISTS (
                SELECT 1 FROM inserted WHERE inserted.scope = existing.scope AND inserted.id = existing.id
            )`,
            [owner, JSON.stringify(input)]
        );
        for (const row of result.rows) {
            const record: BusinessRecord = { ...row, table };
            records.set(recordKey(record), record);
        }
    }
    return changes.map((change) => {
        const record = records.get(recordKey(change));
        if (!record) throw new Error('IMPORT_RECORD_UNAVAILABLE');
        return record;
    });
}
