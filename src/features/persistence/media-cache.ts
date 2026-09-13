import { LEGACY_OWNER_KEY } from './legacy';
import { activateMediaDatabase, VideoDB } from '@/features/assets/storage/db';
import type { BusinessRecord } from '@/shared/contracts/business-data';

export async function prepareMediaCache(owner: string, records: BusinessRecord[]) {
    const target = activateMediaDatabase(owner);
    const marker = `xctStudioMediaCopied:${owner}`;
    if (localStorage.getItem(LEGACY_OWNER_KEY) === owner && !localStorage.getItem(marker)) {
        const original = new VideoDB();
        try {
            const images = await original.images.toArray();
            const videos = await original.videos.toArray();
            await target.transaction('rw', target.images, target.videos, async () => {
                const existingImages = new Set(await target.images.toCollection().primaryKeys());
                const existingVideos = new Set(await target.videos.toCollection().primaryKeys());
                const missingImages = images.filter((record) => !existingImages.has(record.id));
                const missingVideos = videos.filter((record) => !existingVideos.has(record.id));
                if (missingImages.length) await target.images.bulkAdd(missingImages);
                if (missingVideos.length) await target.videos.bulkAdd(missingVideos);
            });
            localStorage.setItem(marker, '1');
        } finally {
            original.close();
        }
    }
    const images = records.filter((record) => record.table === 'media_assets' && record.scope === 'images');
    if (!images.length) return;
    await target.transaction('rw', target.images, async () => {
        const local = await target.images.bulkGet(images.map((record) => record.id));
        const updates = images.flatMap((record, index) => {
            const data = record.data;
            if (!data || typeof data.prompt !== 'string' || typeof data.model !== 'string' || typeof data.size !== 'string')
                return [];
            const cached = local[index];
            const source_url = typeof data.source_url === 'string' ? data.source_url : undefined;
            const created_at = typeof data.created_at === 'number' ? data.created_at : 0;
            if (cached && cached.prompt === data.prompt && cached.model === data.model &&
                cached.size === data.size && cached.source_url === source_url && cached.created_at === created_at)
                return [];
            return [{ ...cached, id: record.id, prompt: data.prompt, model: data.model, size: data.size, source_url, created_at }];
        });
        const deleted = images.filter((record) => !record.data).map((record) => record.id);
        if (deleted.length) await target.images.bulkDelete(deleted);
        if (updates.length) await target.images.bulkPut(updates);
    });
}
