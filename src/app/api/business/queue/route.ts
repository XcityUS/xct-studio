import { isObject } from '@/features/persistence/validation';
import { businessOwner, BusinessError } from '@/server/persistence/auth';
import { claimQueue, releaseQueue } from '@/server/persistence/queue';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const owner = await businessOwner(request);
        const body: unknown = await request.json();
        if (!isObject(body) || typeof body.id !== 'string' || body.id.length > 1024 ||
            (body.action !== undefined && body.action !== 'claim' && body.action !== 'release'))
            throw new BusinessError('INVALID_QUEUE', 422);
        let record;
        if (body.action === 'release') {
            if (typeof body.attemptId !== 'string' || body.attemptId.length > 1024)
                throw new BusinessError('INVALID_QUEUE', 422);
            record = await releaseQueue(owner, body.id, body.attemptId);
        } else {
            record = await claimQueue(owner, body.id);
        }
        return Response.json({ record }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return Response.json(
            { error: error instanceof BusinessError ? error.code : 'DATABASE_UNAVAILABLE' },
            { status: error instanceof BusinessError ? error.status : 503 }
        );
    }
}
