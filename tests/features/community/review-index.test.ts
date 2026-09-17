// The deployed media Worker is still JavaScript; its TypeScript migration is separate work.
// @ts-expect-error Legacy Worker has no TypeScript declaration.
import worker from '../../../media-worker/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

type StoredObject = { body: string; etag: string };

class MemoryBucket {
    private objects = new Map<string, StoredObject>();
    private revision = 0;
    rejectNextIndexPut = false;

    seed(key: string, value: unknown) {
        this.objects.set(key, { body: JSON.stringify(value), etag: `etag-${++this.revision}` });
    }

    async get(key: string) {
        const object = this.objects.get(key);
        return object ? { httpEtag: `"${object.etag}"`, json: async () => JSON.parse(object.body) as unknown } : null;
    }

    async put(key: string, body: string, options?: { onlyIf?: { etagMatches?: string; etagDoesNotExist?: boolean } }) {
        if (key === indexKey && this.rejectNextIndexPut) {
            this.rejectNextIndexPut = false;
            return null;
        }
        const current = this.objects.get(key);
        const onlyIf = options?.onlyIf;
        if (onlyIf?.etagDoesNotExist && current) return null;
        if (onlyIf?.etagMatches && current?.etag !== onlyIf.etagMatches) return null;
        this.objects.set(key, { body, etag: `etag-${++this.revision}` });
        return { key };
    }

    async list() {
        return {
            objects: [...this.objects.keys()].map((key) => ({ key })),
            truncated: false
        };
    }

    value(key: string) {
        return JSON.parse(this.objects.get(key)?.body ?? 'null') as unknown;
    }
}

const shareId = 'new00001';
const indexKey = 'community/index.json';

function shareRecord(plaza: 'pending' | 'approved') {
    return {
        id: shareId,
        owner: 'u/admin',
        title: 'Test video',
        prompt: 'A test prompt',
        video_url: 'https://media.example.test/media/u/admin/video.mp4',
        params: {},
        plaza,
        created_at: '2026-09-18T00:00:00.000Z'
    };
}

function env(current: MemoryBucket, legacy: MemoryBucket) {
    return {
        XCITY_MEDIA: current,
        LEGACY_XCITY_MEDIA: legacy,
        ADMIN_USER_IDS: 'admin',
        LITELLM_BASE_URL: 'https://gateway.example.test'
    };
}

function request(path: string, body?: unknown) {
    return new Request(`https://media.example.test${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('community review index', () => {
    it('migrates a legacy index without using its ETag against the current bucket', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Response.json({ info: { user_id: 'admin' } }))
        );
        const current = new MemoryBucket();
        const legacy = new MemoryBucket();
        current.seed(`share/${shareId}.json`, shareRecord('pending'));
        legacy.seed(indexKey, [{ id: 'old00001', approved_at: '2026-09-17T00:00:00.000Z' }]);

        const response = await worker.fetch(
            request('/community/review', { share_id: shareId, action: 'approve' }),
            env(current, legacy)
        );

        expect(response.status).toBe(200);
        expect(current.value(indexKey)).toEqual([
            { id: shareId, approved_at: expect.any(String) },
            { id: 'old00001', approved_at: '2026-09-17T00:00:00.000Z' }
        ]);
    });

    it('allows an approved share missing from the index to be reviewed again', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Response.json({ info: { user_id: 'admin' } }))
        );
        const current = new MemoryBucket();
        const legacy = new MemoryBucket();
        current.seed(`share/${shareId}.json`, shareRecord('approved'));

        const queue = await worker.fetch(request('/community/queue'), env(current, legacy));
        expect((await queue.json()).items).toEqual([expect.objectContaining({ id: shareId })]);

        const response = await worker.fetch(
            request('/community/review', { share_id: shareId, action: 'approve' }),
            env(current, legacy)
        );
        expect(response.status).toBe(200);
        expect(current.value(indexKey)).toEqual([{ id: shareId, approved_at: expect.any(String) }]);
    });

    it('retries a transient conditional-write conflict', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Response.json({ info: { user_id: 'admin' } }))
        );
        const current = new MemoryBucket();
        const legacy = new MemoryBucket();
        current.seed(`share/${shareId}.json`, shareRecord('pending'));
        current.rejectNextIndexPut = true;

        const response = await worker.fetch(
            request('/community/review', { share_id: shareId, action: 'approve' }),
            env(current, legacy)
        );
        expect(response.status).toBe(200);
        expect(current.value(indexKey)).toEqual([{ id: shareId, approved_at: expect.any(String) }]);
    });
});
