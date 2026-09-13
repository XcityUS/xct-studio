import { safeRecordData } from './codec';
import { businessSessionMatches, businessStatus, flushBusiness, saveBusinessRecord } from './store';
import { isObject } from './validation';
import { db, type ImageRecord } from '@/features/assets/storage/db';

export async function persistImages(images: ImageRecord[]) {
    await db.images.bulkPut(images);
    for (const image of images)
        saveBusinessRecord({
            table: 'media_assets',
            scope: 'images',
            id: image.id,
            data: safeRecordData({ ...image, archivePending: true }),
            baseRevision: 0
        });
    await flushBusiness();
}

export async function removeImage(id: string) {
    saveBusinessRecord({ table: 'media_assets', scope: 'images', id, data: null, baseRevision: 0 });
    await flushBusiness();
    await db.images.delete(id);
}

export function rememberUploadedMedia(url: string, kind: string, name: string, bytes: number, apiKey: string) {
    if (!businessSessionMatches(apiKey)) return;
    const parsed = new URL(url);
    const key = parsed.pathname.startsWith('/media/') ? decodeURIComponent(parsed.pathname.slice(7)) : url;
    saveBusinessRecord({
        table: 'media_assets',
        scope: 'r2',
        id: key,
        data: { key, url, kind, name, bytes, uploaded: new Date().toISOString() },
        baseRevision: 0
    });
}

export function rememberProviderMetadata(body: unknown, apiKey: string) {
    if (!businessSessionMatches(apiKey) || !isObject(body)) return;
    if (Array.isArray(body.groups))
        for (const group of body.groups) {
            if (isObject(group) && typeof group.id === 'string')
                saveBusinessRecord({
                    table: 'provider_asset_groups',
                    scope: 'library',
                    id: group.id,
                    data: safeRecordData(group),
                    baseRevision: 0
                });
        }
    const assets = Array.isArray(body.assets) ? body.assets : typeof body.assetId === 'string' ? [body] : [];
    for (const asset of assets)
        if (isObject(asset) && typeof asset.assetId === 'string') {
            saveBusinessRecord({
                table: 'provider_assets',
                scope: 'provider',
                id: asset.assetId,
                data: safeRecordData(asset),
                baseRevision: 0
            });
        }
    if (typeof body.groupId === 'string' && typeof body.slug === 'string')
        saveBusinessRecord({
            table: 'provider_asset_groups',
            scope: 'library',
            id: body.groupId,
            data: safeRecordData(body),
            baseRevision: 0
        });
}

export function removeProviderGroup(id: string) {
    if (businessStatus().ready)
        saveBusinessRecord({ table: 'provider_asset_groups', scope: 'library', id, data: null, baseRevision: 0 });
}
