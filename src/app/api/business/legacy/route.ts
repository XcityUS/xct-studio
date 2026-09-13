import { encodeDocument } from '@/features/persistence/codec';
import { isObject } from '@/features/persistence/validation';
import { readyDatabase } from '@/server/database/pool';
import { businessOwner, BusinessError } from '@/server/persistence/auth';
import { writeBusinessRecords } from '@/server/persistence/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const owner = await businessOwner(request);
        const pool = await readyDatabase();
        const done = await pool.query(
            `SELECT id FROM user_preferences WHERE owner_id=$1
            AND scope='migration' AND id='worker-history'`,
            [owner]
        );
        if (done.rowCount) return Response.json({ ok: true });
        const worker = (process.env.MEDIA_WORKER_URL || process.env.NEXT_PUBLIC_MEDIA_WORKER_URL || '').replace(
            /\/+$/,
            ''
        );
        if (!worker) return Response.json({ ok: true, skipped: true });
        const response = await fetch(`${worker}/state`, {
            headers: { Authorization: request.headers.get('authorization') ?? '' },
            cache: 'no-store',
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok && response.status !== 404) throw new Error('LEGACY_UNAVAILABLE');
        const body: unknown = response.status === 404 ? {} : await response.json();
        if (!isObject(body)) throw new Error('INVALID_LEGACY');
        for (const [field, name] of Object.entries({
            history: 'soraVideoHistory',
            characters: 'soraVideoCharacters',
            portraits: 'soraVideoPortraits',
            declarations: 'soraReferenceDeclarations',
            deletedIds: 'soraVideoDeletedIds'
        })) {
            if (body[field] === undefined) continue;
            const changes = encodeDocument(name, JSON.stringify(body[field]));
            for (let i = 0; i < changes.length; i += 150)
                await writeBusinessRecords(owner, { mode: 'import', changes: changes.slice(i, i + 150) });
        }
        await writeBusinessRecords(owner, {
            mode: 'import',
            changes: [
                {
                    table: 'user_preferences',
                    scope: 'migration',
                    id: 'worker-history',
                    baseRevision: 0,
                    data: { importedAt: new Date().toISOString() }
                }
            ]
        });
        return Response.json({ ok: true });
    } catch (error) {
        return Response.json(
            { error: error instanceof BusinessError ? error.code : 'LEGACY_IMPORT_UNAVAILABLE' },
            { status: error instanceof BusinessError ? error.status : 503 }
        );
    }
}
