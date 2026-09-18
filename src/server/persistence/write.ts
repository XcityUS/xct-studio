import { BusinessError } from './auth';
import { hasProtectedAssetUsers, isProtectedAssetSubject } from '@/server/assets/protection';
import { TABLES } from '@/server/database/schema';
import { recordKey, type BusinessChange, type BusinessRecord, type BusinessTable, type BusinessWriteResult } from '@/shared/contracts/business-data';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import 'server-only';

const ARCHIVE_FIELDS = new Set(['source_url', 'storedUrl', 'mediaKey', 'bytes', 'archivePending', 'archiveError']);
const ASSET_TABLES = new Set<BusinessTable>([
    'media_assets',
    'project_assets',
    'provider_assets',
    'provider_asset_groups'
]);
function withoutArchive(data: NonNullable<BusinessRecord['data']>) {
    return Object.fromEntries(Object.entries(data).filter(([key]) => !ARCHIVE_FIELDS.has(key)));
}
function archived(data: NonNullable<BusinessRecord['data']>) {
    const url = data.storedUrl ?? data.source_url;
    return data.archivePending === false && typeof url === 'string' && /^https?:\/\/[^/]+\/media\//.test(url);
}

/** The caller owns the transaction and owner lock. Validate all revisions before writing. */
export async function writeRecordBatches(client: PoolClient, owner: string, changes: BusinessChange[]): Promise<BusinessWriteResult> {
    if (hasProtectedAssetUsers() && changes.some((change) => ASSET_TABLES.has(change.table) && change.data === null)) {
        const identity = await client.query<{ external_subject: string }>(
            'SELECT external_subject FROM studio_users WHERE id = $1::uuid',
            [owner]
        );
        if (!identity.rows[0]) throw new BusinessError('ASSET_IDENTITY_UNAVAILABLE', 503);
        if (isProtectedAssetSubject(identity.rows[0].external_subject))
            throw new BusinessError('ASSET_DELETE_PROTECTED', 403);
    }
    const groups = new Map<BusinessTable, BusinessChange[]>();
    const seen = new Set<string>();
    for (const change of changes) {
        const id = recordKey(change);
        if (!TABLES.includes(change.table) || seen.has(id)) throw new BusinessError('INVALID_RECORD', 422);
        seen.add(id);
        const group = groups.get(change.table) ?? [];
        group.push(change);
        groups.set(change.table, group);
    }
    const records = new Map<string, BusinessRecord>();
    const updates = new Map<BusinessTable, BusinessChange[]>();
    const conflicts: string[] = [];
    for (const [table, group] of groups) {
        const result = await client.query<Omit<BusinessRecord, 'table'>>(
            `SELECT existing.scope, existing.id, existing.data, existing.revision
            FROM ${table} existing
            JOIN jsonb_to_recordset($2::jsonb) AS item(scope text, id text)
            ON item.scope = existing.scope AND item.id = existing.id
            WHERE existing.owner_id = $1::uuid FOR UPDATE OF existing`,
            [owner, JSON.stringify(group.map(({ scope, id }) => ({ scope, id })))]
        );
        for (const row of result.rows) {
            const record: BusinessRecord = { ...row, table };
            records.set(recordKey(record), record);
        }
        const changed: BusinessChange[] = [];
        for (const change of group) {
            const current = records.get(recordKey(change));
            // Identical data is already acknowledged, even when this is a retry.
            if (current && isDeepStrictEqual(current.data, change.data)) continue;
            // These scopes mirror upstream inventories, not user-authored edits.
            // An older tab must adopt the acknowledged database snapshot instead
            // of blocking every pending edit or resurrecting a deleted asset.
            const inventory = (table === 'provider_assets' && change.scope === 'provider') ||
                (table === 'provider_asset_groups' && change.scope === 'library') ||
                (table === 'media_assets' && change.scope === 'r2');
            if (current && inventory && change.data !== null && current.revision !== change.baseRevision) continue;
            if (current && table === 'media_assets' && current.revision !== change.baseRevision && change.data) {
                if (!current.data) continue; // A stale cache cannot resurrect an explicitly deleted image/video.
                if (isDeepStrictEqual(withoutArchive(current.data), withoutArchive(change.data))) {
                    if (archived(current.data)) continue;
                    if (archived(change.data)) {
                        changed.push({ ...change, baseRevision: current.revision });
                        continue;
                    }
                }
            }
            if (current && current.revision !== change.baseRevision) {
                const fields = [...new Set([...Object.keys(current.data ?? {}), ...Object.keys(change.data ?? {})])]
                    .filter((key) => !isDeepStrictEqual(current.data?.[key], change.data?.[key]));
                console.info('[business-data] Conflicting fields', { table, scope: change.scope, fields });
            }
            if ((current?.revision ?? 0) !== change.baseRevision) conflicts.push(recordKey(change));
            else changed.push(change);
        }
        if (changed.length) updates.set(table, changed);
    }
    if (conflicts.length) return { records: [], conflicts };
    for (const [table, group] of updates) {
        const result = await client.query<Omit<BusinessRecord, 'table'>>(
            `WITH incoming AS (
                SELECT scope, id, NULLIF(data, 'null'::jsonb) AS data
                FROM jsonb_to_recordset($2::jsonb) AS item(scope text, id text, data jsonb)
            ), archived AS (
                INSERT INTO business_revisions(owner_id, entity_table, scope, entity_id, revision, data)
                SELECT existing.owner_id, '${table}', existing.scope, existing.id, existing.revision, existing.data
                FROM ${table} existing JOIN incoming
                ON incoming.scope = existing.scope AND incoming.id = existing.id
                WHERE existing.owner_id = $1::uuid
                ON CONFLICT DO NOTHING
            )
            INSERT INTO ${table}(owner_id, scope, id, data, deleted_at)
            SELECT $1::uuid, scope, id, data, CASE WHEN data IS NULL THEN now() ELSE NULL END FROM incoming
            ON CONFLICT(owner_id, scope, id) DO UPDATE SET data = EXCLUDED.data,
                deleted_at = EXCLUDED.deleted_at, revision = ${table}.revision + 1, updated_at = now()
            RETURNING scope, id, data, revision`,
            [owner, JSON.stringify(group.map(({ scope, id, data }) => ({ scope, id, data })))]
        );
        for (const row of result.rows) {
            const record: BusinessRecord = { ...row, table };
            records.set(recordKey(record), record);
        }
    }
    return {
        records: changes.map((change) => {
            const record = records.get(recordKey(change));
            if (!record) throw new Error('WRITE_RECORD_UNAVAILABLE');
            return record;
        }),
        conflicts: []
    };
}
