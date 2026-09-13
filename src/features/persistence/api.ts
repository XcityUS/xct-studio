import { isObject } from './validation';
import type {
    BusinessRecord,
    BusinessSnapshot,
    BusinessWrite,
    BusinessWriteResult
} from '@/shared/contracts/business-data';

export class PersistenceError extends Error {
    constructor(public readonly code: string) {
        super(code);
    }
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
    const value: unknown = await response.json();
    if (!isObject(value)) throw new PersistenceError('INVALID_RESPONSE');
    if (!response.ok)
        throw new PersistenceError(
            response.status === 409 ? 'DATA_CONFLICT' : String(value.error ?? 'DATABASE_UNAVAILABLE')
        );
    return value;
}

const snapshots = new Map<string, Promise<BusinessSnapshot>>();

export function fetchSnapshot(key: string): Promise<BusinessSnapshot> {
    const current = snapshots.get(key);
    if (current) return current;
    const request = readSnapshot(key).finally(() => {
        if (snapshots.get(key) === request) snapshots.delete(key);
    });
    snapshots.set(key, request);
    return request;
}

async function readSnapshot(key: string): Promise<BusinessSnapshot> {
    const records: BusinessRecord[] = [];
    let cursor: string | null = null;
    let owner = '';
    do {
        const response = await fetch(`/api/business${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
            headers: { Authorization: `Bearer ${key}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(30000)
        });
        const body = await responseBody(response);
        if (!Array.isArray(body.records) || typeof body.owner !== 'string')
            throw new PersistenceError('INVALID_RESPONSE');
        if (owner && body.owner !== owner) throw new PersistenceError('ACCOUNT_CHANGED');
        owner = body.owner;
        records.push(...(body.records as BusinessRecord[]));
        cursor = typeof body.cursor === 'string' ? body.cursor : null;
    } while (cursor);
    return { owner, records, cursor: null };
}

export async function postChanges(key: string, input: BusinessWrite): Promise<BusinessWriteResult> {
    const payload = JSON.stringify(input);
    for (let attempt = 0; ; attempt += 1) {
        try {
            const response = await fetch('/api/business', {
                method: 'POST',
                headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: payload,
                signal: AbortSignal.timeout(30000)
            });
            const body = await responseBody(response);
            if (!Array.isArray(body.records)) throw new PersistenceError('INVALID_RESPONSE');
            return body as unknown as BusinessWriteResult;
        } catch (error) {
            // Busy means the transaction did not write. Never retry conflicts,
            // rejected credentials or ambiguous network failures automatically here.
            if (!(error instanceof PersistenceError) || error.code !== 'DATABASE_BUSY' || attempt >= 4) throw error;
            await new Promise<void>((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
        }
    }
}
