import Dexie, { type EntityTable } from 'dexie';

export interface VideoRecord {
    id: string; // video job id
    filename: string;
    blob?: Blob; // MP4 blob
    thumbnail?: Blob; // WebP thumbnail
    created_at: number;
}

export interface ImageRecord {
    id: string;
    prompt: string;
    model: string;
    size: string;
    /** PNG bytes; absent when the provider URL wasn't CORS-readable. */
    blob?: Blob;
    /** Provider URL fallback (may expire). */
    source_url?: string;
    created_at: number;
}

// Database name stays "SoraVideoDB" — renaming would orphan existing users'
// stored videos.
export class VideoDB extends Dexie {
    videos!: EntityTable<VideoRecord, 'id'>;
    images!: EntityTable<ImageRecord, 'id'>;

    constructor() {
        super('SoraVideoDB');

        this.version(1).stores({
            videos: '&id, filename, created_at'
        });

        // v2 adds generated images (the text-to-image tab).
        this.version(2).stores({
            videos: '&id, filename, created_at',
            images: '&id, created_at'
        });

        this.videos = this.table('videos');
        this.images = this.table('images');
    }
}

export const db = new VideoDB();
