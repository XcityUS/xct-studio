import type { PoolClient } from 'pg';
import 'server-only';

// SQL identifiers are an application-owned allowlist, never request input.
export const TABLES = [
    'user_preferences',
    'projects',
    'episodes',
    'script_versions',
    'characters',
    'character_versions',
    'scenes',
    'shots',
    'shot_characters',
    'media_assets',
    'project_assets',
    'asset_bindings',
    'provider_asset_groups',
    'provider_assets',
    'reference_declarations',
    'generation_batches',
    'generation_jobs',
    'generation_results',
    'episode_versions',
    'exports',
    'asset_authorizations',
    'shares',
    'community_posts',
    'review_events'
] as const;

export async function migrateSchema(client: PoolClient): Promise<void> {
    await client.query('BEGIN');
    try {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('xct-studio-schema-v1'))");
        await client.query(`CREATE TABLE IF NOT EXISTS studio_schema_versions (
            version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
        )`);
        const applied = await client.query('SELECT version FROM studio_schema_versions WHERE version = 1');
        if (applied.rowCount) {
            await client.query('COMMIT');
            return;
        }
        await client.query(`CREATE TABLE IF NOT EXISTS studio_users (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            external_subject text NOT NULL UNIQUE,
            created_at timestamptz NOT NULL DEFAULT now()
        )`);
        for (const table of TABLES) {
            await client.query(`CREATE TABLE IF NOT EXISTS ${table} (
                owner_id uuid NOT NULL REFERENCES studio_users(id),
                scope text NOT NULL, id text NOT NULL,
                data jsonb, revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
                PRIMARY KEY (owner_id, scope, id),
                CHECK ((data IS NULL) = (deleted_at IS NOT NULL)),
                CHECK (data IS NULL OR jsonb_typeof(data) = 'object')
            )`);
            await client.query(`CREATE INDEX IF NOT EXISTS ${table}_project_idx
                ON ${table} (owner_id, (data->>'projectId')) WHERE deleted_at IS NULL`);
        }
        await client.query(`CREATE TABLE IF NOT EXISTS business_revisions (
            owner_id uuid NOT NULL REFERENCES studio_users(id), entity_table text NOT NULL,
            scope text NOT NULL, entity_id text NOT NULL, revision integer NOT NULL, data jsonb,
            captured_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY(owner_id, entity_table, scope, entity_id, revision)
        )`);
        await client.query(`CREATE TABLE IF NOT EXISTS data_imports (
            owner_id uuid NOT NULL REFERENCES studio_users(id), fingerprint text NOT NULL,
            record_count integer NOT NULL, completed_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY(owner_id, fingerprint)
        )`);
        await client.query('INSERT INTO studio_schema_versions(version) VALUES (1)');
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}
