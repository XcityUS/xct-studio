import { migrateSchema } from './schema.ts';
import { Pool } from 'pg';
import 'server-only';

const database = globalThis as typeof globalThis & { studioPool?: Pool; studioSchema?: Promise<void> };

export function databasePool(): Pool {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
    if (!database.studioPool) {
        database.studioPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 8,
            connectionTimeoutMillis: 8000,
            idleTimeoutMillis: 30000,
            options: '-c idle_in_transaction_session_timeout=15000',
            statement_timeout: 15000
        });
        database.studioPool.on('error', () => console.error('[business-data] Database connection interrupted'));
    }
    return database.studioPool;
}

export async function readyDatabase(): Promise<Pool> {
    const pool = databasePool();
    database.studioSchema ??= (async () => {
        const client = await pool.connect();
        try {
            await migrateSchema(client);
        } finally {
            client.release();
        }
    })().catch((error: unknown) => {
        database.studioSchema = undefined;
        throw error;
    });
    await database.studioSchema;
    return pool;
}
