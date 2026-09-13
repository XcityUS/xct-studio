import { isObject } from '@/features/persistence/validation';
import { readyDatabase } from '@/server/database/pool';
import { TABLES } from '@/server/database/schema';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import 'server-only';

export class BusinessError extends Error {
    constructor(
        public readonly code: string,
        public readonly status: number
    ) {
        super(code);
    }
}

type Identity = {
    canonicalSubject: string;
    legacySubjects: string[];
};

const LEGACY_IDENTITY_BASES = ['https://tokenhub.xcity.ai', 'https://tokenhub.xcity.one'] as const;
const subjects = new Map<string, Identity & { until: number; owner?: string }>();
const resolving = new Map<string, Promise<string>>();

export function identitySubjects(base: string, userId: string): Identity {
    const canonicalSubject = `xcity:${userId}`;
    return {
        canonicalSubject,
        legacySubjects: [
            canonicalSubject,
            `${base}:${userId}`,
            ...LEGACY_IDENTITY_BASES.map((legacyBase) => `${legacyBase}:${userId}`)
        ].filter((value, index, values) => values.indexOf(value) === index)
    };
}

export async function businessOwner(request: Request): Promise<string> {
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!bearer) throw new BusinessError('AUTH_REQUIRED', 401);
    const hash = createHash('sha256').update(bearer).digest('hex');
    const active = resolving.get(hash);
    if (active) return active;
    if (resolving.size >= 1000) throw new BusinessError('IDENTITY_UNAVAILABLE', 503);
    const requestOwner = resolveOwner(bearer, hash);
    resolving.set(hash, requestOwner);
    try {
        return await requestOwner;
    } finally {
        resolving.delete(hash);
    }
}

async function resolveOwner(bearer: string, hash: string): Promise<string> {
    let subject = subjects.get(hash);
    if (!subject || subject.until < Date.now()) {
        const base = (
            process.env.XCITY_LITELLM_URL ||
            process.env.TOKENHUB_URL ||
            process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL ||
            'https://tokenhub.xcity.one'
        )
            .replace(/\/+$/, '')
            .replace(/\/v1$/, '');
        const response = await fetch(`${base}/key/info`, {
            headers: { Authorization: `Bearer ${bearer}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(10000)
        });
        if (response.status === 401 || response.status === 403) throw new BusinessError('AUTH_REQUIRED', 401);
        if (!response.ok) throw new BusinessError('IDENTITY_UNAVAILABLE', 503);
        const body: unknown = await response.json();
        const userId = isObject(body) && isObject(body.info) ? body.info.user_id : undefined;
        if (typeof userId !== 'string' || !userId.trim()) throw new BusinessError('STABLE_IDENTITY_REQUIRED', 403);
        subject = { ...identitySubjects(base, userId), until: Date.now() + 30000 };
        if (subjects.size >= 1000) subjects.clear();
        subjects.set(hash, subject);
    }
    if (subject.owner) return subject.owner;
    const pool = await readyDatabase();
    const client = await pool.connect();
    try {
        subject.owner = await resolveIdentityOwner(client, subject);
    } finally {
        client.release();
    }
    return subject.owner;
}

async function resolveIdentityOwner(client: PoolClient, identity: Identity): Promise<string> {
    await client.query('BEGIN');
    try {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [identity.canonicalSubject]);
        const existing = await client.query<{ id: string; external_subject: string }>(
            `SELECT id, external_subject FROM studio_users
            WHERE external_subject = ANY($1::text[])
            ORDER BY (external_subject = $2) DESC, created_at ASC
            FOR UPDATE`,
            [identity.legacySubjects, identity.canonicalSubject]
        );
        let owner = existing.rows[0]?.id;
        if (!owner) {
            const inserted = await client.query<{ id: string }>(
                'INSERT INTO studio_users(external_subject) VALUES ($1) RETURNING id',
                [identity.canonicalSubject]
            );
            owner = inserted.rows[0].id;
        } else if (existing.rows[0].external_subject !== identity.canonicalSubject) {
            await client.query('UPDATE studio_users SET external_subject=$1 WHERE id=$2', [
                identity.canonicalSubject,
                owner
            ]);
        }
        for (const duplicate of existing.rows.slice(1)) {
            await mergeOwner(client, owner, duplicate.id);
        }
        await client.query('COMMIT');
        return owner;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}

async function mergeOwner(client: PoolClient, owner: string, duplicate: string): Promise<void> {
    for (const table of TABLES) {
        await client.query(
            `INSERT INTO ${table}(owner_id,scope,id,data,revision,created_at,updated_at,deleted_at)
            SELECT $1,scope,id,data,revision,created_at,updated_at,deleted_at
            FROM ${table} WHERE owner_id=$2
            ON CONFLICT(owner_id,scope,id) DO UPDATE SET
                data = CASE WHEN (EXCLUDED.revision, EXCLUDED.updated_at) >
                    (${table}.revision, ${table}.updated_at) THEN EXCLUDED.data ELSE ${table}.data END,
                revision = GREATEST(${table}.revision, EXCLUDED.revision),
                created_at = LEAST(${table}.created_at, EXCLUDED.created_at),
                updated_at = GREATEST(${table}.updated_at, EXCLUDED.updated_at),
                deleted_at = CASE WHEN (EXCLUDED.revision, EXCLUDED.updated_at) >
                    (${table}.revision, ${table}.updated_at) THEN EXCLUDED.deleted_at ELSE ${table}.deleted_at END`,
            [owner, duplicate]
        );
        await client.query(`DELETE FROM ${table} WHERE owner_id=$1`, [duplicate]);
    }
    await client.query(
        `INSERT INTO business_revisions(owner_id,entity_table,scope,entity_id,revision,data,captured_at)
        SELECT $1,entity_table,scope,entity_id,revision,data,captured_at
        FROM business_revisions WHERE owner_id=$2 ON CONFLICT DO NOTHING`,
        [owner, duplicate]
    );
    await client.query('DELETE FROM business_revisions WHERE owner_id=$1', [duplicate]);
    await client.query(
        `INSERT INTO data_imports(owner_id,fingerprint,record_count,completed_at)
        SELECT $1,fingerprint,record_count,completed_at
        FROM data_imports WHERE owner_id=$2 ON CONFLICT DO NOTHING`,
        [owner, duplicate]
    );
    await client.query('DELETE FROM data_imports WHERE owner_id=$1', [duplicate]);
    await client.query('DELETE FROM studio_users WHERE id=$1', [duplicate]);
}
