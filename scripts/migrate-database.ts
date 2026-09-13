import { databasePool, readyDatabase } from '../src/server/database/pool.ts';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'], quiet: true });

try {
    const pool = await readyDatabase();
    const result = await pool.query<{ version: number }>('SELECT version FROM studio_schema_versions ORDER BY version');
    console.log(`Database ready. Schema versions: ${result.rows.map((row) => row.version).join(', ')}`);
} catch {
    console.error(
        'Database setup failed. Check DATABASE_URL and network access; Railway internal hosts require the Railway network.'
    );
    process.exitCode = 1;
} finally {
    if (process.env.DATABASE_URL) await databasePool().end();
}
