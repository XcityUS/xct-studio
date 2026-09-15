import type { ImageRecord, VideoRecord } from '@/features/assets/storage/db';
import type { BusinessRecord } from '@/shared/contracts/business-data';

export const LOCAL_SOURCE_MISSING_ARCHIVE_ERROR = 'LOCAL_SOURCE_MISSING';
export const ARCHIVE_UNAVAILABLE_ERROR = 'ARCHIVE_UNAVAILABLE';

export function findPendingArchivesWithoutLocalSource(
    records: readonly BusinessRecord[],
    images: readonly ImageRecord[],
    videos: readonly VideoRecord[]
): BusinessRecord[] {
    const uploadableImages = new Set(
        images
            .filter((image) => Boolean(image.blob) || Boolean(image.source_url))
            .map((image) => image.id)
    );
    const uploadableVideos = new Set(
        videos
            .filter((video) => Boolean(video.blob))
            .map((video) => video.id)
    );

    return records.filter((record) => {
        if (record.table !== 'media_assets' || !record.data?.archivePending) return false;
        if (record.scope === 'images') return !uploadableImages.has(record.id);
        if (record.scope === 'videos') return !uploadableVideos.has(record.id);
        return false;
    });
}
