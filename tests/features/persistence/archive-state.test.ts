import {
    findPendingArchivesWithoutLocalSource,
    LOCAL_SOURCE_MISSING_ARCHIVE_ERROR
} from '@/features/persistence/archive-state';
import type { BusinessRecord } from '@/shared/contracts/business-data';
import { describe, expect, it } from 'vitest';

const mediaRecord = (scope: string, id: string, archivePending = true): BusinessRecord => ({
    table: 'media_assets',
    scope,
    id,
    data: { archivePending },
    revision: 1
});

describe('media archive reconciliation', () => {
    it('stops stale pending records when this device has no uploadable source', () => {
        const records = [mediaRecord('videos', 'missing-video'), mediaRecord('images', 'missing-image')];

        expect(findPendingArchivesWithoutLocalSource(records, [], []).map((record) => record.id))
            .toEqual(['missing-video', 'missing-image']);
        expect(LOCAL_SOURCE_MISSING_ARCHIVE_ERROR).toBe('LOCAL_SOURCE_MISSING');
    });

    it('keeps records pending when a local upload source can still be retried', () => {
        const records = [mediaRecord('videos', 'local-video'), mediaRecord('images', 'remote-image')];
        const videos = [{
            id: 'local-video',
            filename: 'video.mp4',
            blob: new Blob(['video']),
            created_at: 1
        }];
        const images = [{
            id: 'remote-image',
            prompt: 'fixture',
            model: 'fixture',
            size: '1x1',
            source_url: 'https://media.example/image.png',
            created_at: 1
        }];

        expect(findPendingArchivesWithoutLocalSource(records, images, videos)).toEqual([]);
    });

    it('ignores completed, tombstoned, remote inventory, and non-media records', () => {
        const records: BusinessRecord[] = [
            mediaRecord('videos', 'complete', false),
            { ...mediaRecord('videos', 'deleted'), data: null },
            mediaRecord('r2', 'remote'),
            { table: 'projects', scope: 'projects', id: 'project', data: { archivePending: true }, revision: 1 }
        ];

        expect(findPendingArchivesWithoutLocalSource(records, [], [])).toEqual([]);
    });
});
