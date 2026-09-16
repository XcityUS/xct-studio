import { autoBindCharacterAssets } from '@/features/studio/components/StudioWorkspace/character-asset-autobind';
import { autoBindSceneAssets } from '@/features/studio/components/StudioWorkspace/scene-asset-autobind';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import type { UserAsset } from '@/lib/media-archive';
import { describe, expect, it, vi } from 'vitest';

const projectTitle = '我的短剧项目';
const characterAsset: UserAsset = {
    key: 'refs/hero.png',
    url: 'https://media.xcity.ai/hero.png',
    bytes: 1024,
    uploaded: '2026-09-16T00:00:00Z',
    kind: 'image',
    name: '主角.png'
};
const sceneAsset: UserAsset = {
    key: 'refs/office.png',
    url: 'https://media.xcity.ai/office.png',
    bytes: 1024,
    uploaded: '2026-09-16T00:00:00Z',
    kind: 'image',
    name: '办公室.png'
};
const draft: EditorDraft = {
    script: '',
    globalNote: '',
    automatic: true,
    characters: [
        {
            id: 'character-1',
            name: '主角',
            aliases: [],
            description: '',
            evidence: [],
            presence: 'on_screen',
            major: true
        }
    ],
    scenes: [{ id: 'scene-1', name: '办公室', description: '', evidence: [] }],
    shots: [
        {
            id: 'shot-1',
            description: '主角走进办公室',
            durationSeconds: 5,
            characterIds: ['character-1'],
            sceneId: 'scene-1'
        }
    ]
};

describe('generated short-drama asset grouping', () => {
    it('reviews character assets inside the project directory', async () => {
        const reviewAsset = vi.fn(async () => 'asset://character-asset');

        await autoBindCharacterAssets({
            draft,
            imageAssets: [characterAsset],
            imageModel: 'seedream',
            uploadEnabled: true,
            assetGroupName: projectTitle,
            basePrompt: '',
            styleNote: '',
            loadImageAssets: async () => [],
            generateImages: vi.fn(),
            reviewAsset,
            resolveKey: async () => 'key'
        });

        expect(reviewAsset).toHaveBeenCalledWith(
            expect.objectContaining({ name: '主角', groupName: projectTitle })
        );
    });

    it('reviews scene assets inside the same project directory', async () => {
        const reviewAsset = vi.fn(async () => 'asset://scene-asset');

        await autoBindSceneAssets({
            draft,
            imageAssets: [sceneAsset],
            imageModel: 'seedream',
            ratio: '16:9',
            uploadEnabled: true,
            assetGroupName: projectTitle,
            basePrompt: '',
            styleNote: '',
            loadImageAssets: async () => [],
            generateImages: vi.fn(),
            reviewAsset,
            resolveKey: async () => 'key'
        });

        expect(reviewAsset).toHaveBeenCalledWith(
            expect.objectContaining({ name: '办公室', groupName: projectTitle })
        );
    });
});
