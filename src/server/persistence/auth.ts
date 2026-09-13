import { isObject } from '@/features/persistence/validation';
import { readyDatabase } from '@/server/database/pool';
import { createHash } from 'node:crypto';
import 'server-only';

export class BusinessError extends Error {
    constructor(
        public readonly code: string,
        public readonly status: number
    ) {
        super(code);
    }
}

const subjects = new Map<string, { subject: string; until: number; owner?: string }>();
const resolving = new Map<string, Promise<string>>();

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
        subject = { subject: `${base}:${userId}`, until: Date.now() + 30000 };
        if (subjects.size >= 1000) subjects.clear();
        subjects.set(hash, subject);
    }
    if (subject.owner) return subject.owner;
    const pool = await readyDatabase();
    const existing = await pool.query<{ id: string }>(
        'SELECT id FROM studio_users WHERE external_subject = $1',
        [subject.subject]
    );
    if (existing.rows[0]) {
        subject.owner = existing.rows[0].id;
        return subject.owner;
    }
    const result = await pool.query<{ id: string }>(
        `INSERT INTO studio_users(external_subject) VALUES ($1)
        ON CONFLICT(external_subject) DO UPDATE SET external_subject = EXCLUDED.external_subject RETURNING id`,
        [subject.subject]
    );
    subject.owner = result.rows[0].id;
    return subject.owner;
}
