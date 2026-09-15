'use client';

import { safeRecordData } from './codec';
import {
    ARCHIVE_UNAVAILABLE_ERROR,
    findPendingArchivesWithoutLocalSource,
    LOCAL_SOURCE_MISSING_ARCHIVE_ERROR
} from './archive-state';
import { businessOwner, businessRecords, businessSessionMatches, saveBusinessRecord } from './store';
import { db } from '@/features/assets/storage/db';
import { archiveLocalVideo, listUserAssets, mediaKeyFromUrl, uploadReferenceImage } from '@/lib/media-archive';
import { useEffect } from 'react';

export function useMediaPersistence(apiKey: string | null) {
    useEffect(() => {
        if (!apiKey) return;
        const owner = businessOwner();
        const database = db;
        let cancelled = false;
        let busy = false;
        let lastInventory = 0;
        let remoteInventoryEmpty = false;
        let timer: number | null = null;
        const retryAt = new Map<string, number>();
        const alive = () => !cancelled && businessOwner() === owner && businessSessionMatches(apiKey);
        const persist = (scope: string, id: string, value: unknown) => {
            if (alive())
                saveBusinessRecord({ table: 'media_assets', scope, id, data: safeRecordData(value), baseRevision: 0 });
        };
        const hasPendingArchive = () =>
            businessRecords().some((record) => record.table === 'media_assets' && Boolean(record.data?.archivePending));
        const schedule = (delayMs: number) => {
            if (cancelled) return;
            if (timer) window.clearTimeout(timer);
            timer = window.setTimeout(() => void scan(), delayMs);
        };
        const scan = async () => {
            if (busy || !alive()) return;
            busy = true;
            let nextDelay = 60_000;
            try {
                const images = await database.images.toArray();
                const videos = await database.videos.toArray();
                const hasLocalMedia = images.length > 0 || videos.length > 0;
                const known = businessRecords();
                nextDelay = hasLocalMedia || hasPendingArchive() ? 10_000 : 60_000;
                for (const record of findPendingArchivesWithoutLocalSource(known, images, videos)) {
                    if (!alive() || !record.data) return;
                    persist(record.scope, record.id, {
                        ...record.data,
                        archivePending: false,
                        archiveError: LOCAL_SOURCE_MISSING_ARCHIVE_ERROR
                    });
                }
                for (const image of images) {
                    if (!alive()) return;
                    if ((retryAt.get(image.id) ?? 0) > Date.now()) continue;
                    const stored = known.find(
                        (r) => r.table === 'media_assets' && r.scope === 'images' && r.id === image.id
                    );
                    if (stored && !stored.data) {
                        await database.images.delete(image.id);
                        continue;
                    }
                    if (mediaKeyFromUrl(image.source_url ?? '')) {
                        persist('images', image.id, { ...image, archivePending: false });
                        continue;
                    }
                    persist('images', image.id, { ...image, archivePending: true });
                    try {
                        let blob = image.blob;
                        if (!blob && image.source_url && /^https?:\/\//i.test(image.source_url)) {
                            const response = await fetch(image.source_url, { signal: AbortSignal.timeout(15000) });
                            if (!response.ok || Number(response.headers.get('Content-Length')) > 10 * 1024 * 1024)
                                throw new Error('SOURCE_UNAVAILABLE');
                            blob = await response.blob();
                        }
                        if (!blob || blob.size > 10 * 1024 * 1024) throw new Error('SOURCE_UNAVAILABLE');
                        const url = await uploadReferenceImage(
                            new File([blob], `${image.id}.png`, { type: blob.type || 'image/png' }),
                            apiKey,
                            image.id,
                            AbortSignal.timeout(30000)
                        );
                        if (!alive()) return;
                        await database.images.update(image.id, { source_url: url });
                        persist('images', image.id, { ...image, source_url: url, archivePending: false });
                    } catch {
                        retryAt.set(image.id, Date.now() + 60000);
                        persist('images', image.id, {
                            ...image,
                            archivePending: true,
                            archiveError: ARCHIVE_UNAVAILABLE_ERROR
                        });
                    }
                }
                // Absence from this device is not a cloud deletion. Only explicit deletes create tombstones.
                for (const video of videos) {
                    if (!alive()) return;
                    const stored = known.find(
                        (r) => r.table === 'media_assets' && r.scope === 'videos' && r.id === video.id
                    );
                    if ((stored && !stored.data) || (retryAt.get(video.id) ?? 0) > Date.now()) continue;
                    if (stored?.data?.storedUrl || !video.blob) continue;
                    persist('videos', video.id, {
                        id: video.id,
                        filename: video.filename,
                        created_at: video.created_at,
                        archivePending: true
                    });
                    const archived = await archiveLocalVideo(
                        video.id,
                        video.blob,
                        apiKey,
                        video.filename,
                        AbortSignal.timeout(30000)
                    );
                    if (archived)
                        persist('videos', video.id, {
                            id: video.id,
                            filename: video.filename,
                            created_at: video.created_at,
                            storedUrl: archived.url,
                            mediaKey: archived.key,
                            bytes: archived.bytes,
                            archivePending: false
                        });
                    else {
                        retryAt.set(video.id, Date.now() + 60000);
                        persist('videos', video.id, {
                            id: video.id,
                            filename: video.filename,
                            created_at: video.created_at,
                            archivePending: true,
                            archiveError: ARCHIVE_UNAVAILABLE_ERROR
                        });
                    }
                }
                if (!remoteInventoryEmpty && Date.now() - lastInventory > 60000) {
                    lastInventory = Date.now();
                    const assets = await listUserAssets(apiKey);
                    remoteInventoryEmpty = assets.length === 0;
                    for (const asset of assets) persist('r2', asset.key, asset);
                }
            } catch {
                // Metadata/outbox survives; original bytes remain in IndexedDB for the next attempt.
                window.dispatchEvent(new Event('business-media-pending'));
                nextDelay = 60_000;
            } finally {
                busy = false;
                schedule(nextDelay);
            }
        };
        void scan();
        const handleMediaPending = () => {
            remoteInventoryEmpty = false;
            void scan();
        };
        window.addEventListener('business-media-pending', handleMediaPending);
        return () => {
            cancelled = true;
            if (timer) window.clearTimeout(timer);
            window.removeEventListener('business-media-pending', handleMediaPending);
        };
    }, [apiKey]);
}
