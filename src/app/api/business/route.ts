import { isObject, validateChange } from '@/features/persistence/validation';
import { BusinessError, businessOwner } from '@/server/persistence/auth';
import { readBusinessRecords, writeBusinessRecords, type BusinessCursor } from '@/server/persistence/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

function failure(error: unknown): Response {
    if (error instanceof BusinessError) return Response.json({ error: error.code }, { status: error.status, headers });
    if (error instanceof Error && error.message === 'DATABASE_NOT_CONFIGURED') {
        return Response.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503, headers });
    }
    const code = error && typeof error === 'object' && 'code' in error &&
        typeof error.code === 'string' && /^[A-Z0-9_]{2,40}$/.test(error.code) ? error.code : 'UNKNOWN';
    // Do not log raw database errors: they may include user payloads or connection details.
    console.error('[business-data] Request failed', { code });
    if (code === '57014' || code === '55P03') {
        return Response.json(
            { error: code === '57014' ? 'DATABASE_TIMEOUT' : 'DATABASE_BUSY' },
            { status: 503, headers }
        );
    }
    return Response.json({ error: 'DATABASE_UNAVAILABLE' }, { status: 503, headers });
}

function decodeCursor(value: string | null): BusinessCursor | undefined {
    if (!value) return undefined;
    try {
        const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
        if (!Array.isArray(parsed) || parsed.length !== 3 || parsed.some((item) => typeof item !== 'string'))
            throw new Error('INVALID_CURSOR');
        return { table: parsed[0] as BusinessCursor['table'], scope: parsed[1], id: parsed[2] };
    } catch {
        throw new BusinessError('INVALID_CURSOR', 400);
    }
}

function encodeCursor(record: BusinessCursor): string {
    return Buffer.from(JSON.stringify([record.table, record.scope, record.id])).toString('base64url');
}

export async function GET(request: Request) {
    try {
        const started = performance.now();
        const owner = await businessOwner(request);
        const authenticated = performance.now();
        const after = decodeCursor(new URL(request.url).searchParams.get('cursor'));
        const records = await readBusinessRecords(owner, after);
        const completed = performance.now();
        const authMs = (authenticated - started).toFixed(1);
        const readMs = (completed - authenticated).toFixed(1);
        if (completed - started > 1000) {
            console.info('[business-data] Slow snapshot', { authMs, readMs, records: records.length });
        }
        return Response.json(
            { owner, records, cursor: records.length === 250 ? encodeCursor(records[records.length - 1]) : null },
            { headers: { ...headers, 'Server-Timing': `auth;dur=${authMs}, read;dur=${readMs}` } }
        );
    } catch (error) {
        return failure(error);
    }
}

async function readBody(request: Request): Promise<unknown> {
    const reader = request.body?.getReader();
    if (!reader) throw new BusinessError('INVALID_BODY', 400);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 16 * 1024 * 1024) {
            await reader.cancel();
            throw new BusinessError('BODY_TOO_LARGE', 413);
        }
        chunks.push(value);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
        throw new BusinessError('INVALID_BODY', 400);
    }
}

export async function POST(request: Request) {
    try {
        const started = performance.now();
        const owner = await businessOwner(request);
        const authenticated = performance.now();
        const body = await readBody(request);
        if (
            !isObject(body) ||
            !['import', 'write'].includes(String(body.mode)) ||
            !Array.isArray(body.changes) ||
            body.changes.length > 200
        )
            throw new BusinessError('INVALID_BODY', 400);
        let changes;
        try {
            changes = body.changes.map(validateChange);
        } catch {
            throw new BusinessError('INVALID_RECORD', 422);
        }
        const writeStarted = performance.now();
        const result = await writeBusinessRecords(owner, { mode: body.mode as 'import' | 'write', changes });
        const completed = performance.now();
        const authMs = (authenticated - started).toFixed(1);
        const writeMs = (completed - writeStarted).toFixed(1);
        if (completed - started > 1000) {
            console.info('[business-data] Slow write', { mode: body.mode, records: changes.length, authMs, writeMs });
        }
        return Response.json(result, {
            status: result.conflicts.length ? 409 : 200,
            headers: { ...headers, 'Server-Timing': `auth;dur=${authMs}, write;dur=${writeMs}` }
        });
    } catch (error) {
        return failure(error);
    }
}
