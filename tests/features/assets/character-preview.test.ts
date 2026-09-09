import { characterPreviewUrl } from '@/features/generation/history/characters';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/history/merge';
import { describe, expect, it } from 'vitest';

const portrait: VideoPortrait = {
    assetId: 'asset-123',
    groupId: 'group-1',
    groupType: 'AIGC',
    name: 'Character',
    thumbUrl: 'https://media.xcity.ai/media/character.png',
    status: 'Active',
    updatedAt: 1
};

describe('characterPreviewUrl', () => {
    it('keeps the Asset ID for submission but resolves its synced thumbnail for display', () => {
        const character: VideoCharacter = { id: 'character-1', name: 'Character', url: 'asset://asset-123' };

        expect(characterPreviewUrl(character, [portrait])).toBe(portrait.thumbUrl);
        expect(character.url).toBe('asset://asset-123');
    });

    it('prefers a separately stored browser preview URL', () => {
        const character: VideoCharacter = {
            id: 'character-1',
            name: 'Character',
            url: 'asset://asset-123',
            previewUrl: 'https://media.xcity.ai/media/upload.png'
        };

        expect(characterPreviewUrl(character, [portrait])).toBe(character.previewUrl);
    });

    it('replaces a legacy video preview with the matching provider thumbnail', () => {
        const character: VideoCharacter = {
            id: 'character-1',
            name: 'Character',
            url: 'asset://asset-123',
            previewUrl: 'https://media.xcity.ai/media/video_character.mp4?version=1'
        };

        expect(characterPreviewUrl(character, [portrait])).toBe(portrait.thumbUrl);
    });

    it('does not send a video URL to an image element when no thumbnail exists', () => {
        const character: VideoCharacter = {
            id: 'character-1',
            name: 'Character',
            url: 'https://media.xcity.ai/media/video_character.webm'
        };

        expect(characterPreviewUrl(character, [])).toBeNull();
    });

    it('does not expose provider-only schemes to image elements', () => {
        const character: VideoCharacter = { id: 'character-1', name: 'Character', url: 'asset://missing' };

        expect(characterPreviewUrl(character, [])).toBeNull();
    });
});
