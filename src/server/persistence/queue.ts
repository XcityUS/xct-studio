import { BusinessError } from './auth';
import { readyDatabase } from '@/server/database/pool';
import type { BusinessRecord } from '@/shared/contracts/business-data';
import { randomUUID } from 'node:crypto';
import 'server-only';

export async function claimQueue(owner: string, id: string): Promise<BusinessRecord> {
    const client = await (await readyDatabase()).connect();
    try {
        await client.query('BEGIN');
        const selected = await client.query<BusinessRecord>(
            `SELECT scope,id,data,revision FROM generation_jobs
            WHERE owner_id=$1 AND scope='queue' AND id=$2 FOR UPDATE`,
            [owner, id]
        );
        const current = selected.rows[0];
        if (!current?.data) throw new BusinessError('QUEUE_ITEM_MISSING', 404);
        if (current.data.execution) throw new BusinessError('QUEUE_ALREADY_CLAIMED', 409);
        const data = {
            ...current.data,
            execution: { status: 'submitting', attemptId: randomUUID(), claimedAt: new Date().toISOString() }
        };
        const updated = await client.query<BusinessRecord>(
            `UPDATE generation_jobs SET data=$3, revision=revision+1, updated_at=now()
            WHERE owner_id=$1 AND scope='queue' AND id=$2 RETURNING scope,id,data,revision`,
            [owner, id, data]
        );
        await client.query('COMMIT');
        return { ...updated.rows[0], table: 'generation_jobs' };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function releaseQueue(owner: string, id: string, attemptId: string): Promise<BusinessRecord> {
    const client = await (await readyDatabase()).connect();
    try {
        await client.query('BEGIN');
        const selected = await client.query<BusinessRecord>(
            `SELECT scope,id,data,revision FROM generation_jobs
            WHERE owner_id=$1 AND scope='queue' AND id=$2 FOR UPDATE`,
            [owner, id]
        );
        const current = selected.rows[0];
        if (!current?.data) throw new BusinessError('QUEUE_ITEM_MISSING', 404);
        const execution = current.data.execution;
        if (!execution || typeof execution !== 'object' || Array.isArray(execution) || execution.attemptId !== attemptId)
            throw new BusinessError('QUEUE_CLAIM_CHANGED', 409);
        const data = { ...current.data };
        delete data.execution;
        const updated = await client.query<BusinessRecord>(
            `UPDATE generation_jobs SET data=$3, revision=revision+1, updated_at=now()
            WHERE owner_id=$1 AND scope='queue' AND id=$2 RETURNING scope,id,data,revision`,
            [owner, id, data]
        );
        await client.query('COMMIT');
        return { ...updated.rows[0], table: 'generation_jobs' };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
