import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';

export function mergeAssetBindings(current: EditorDraft, draft: EditorDraft, baseDraft?: EditorDraft): EditorDraft {
    const baseCharacterAssets = new Map(baseDraft?.characters.map((item) => [item.id, item.assetId]));
    const baseSceneAssets = new Map(baseDraft?.scenes.map((item) => [item.id, item.assetId]));
    const characterAssets = new Map(
        draft.characters
            .filter((item) => item.assetId !== baseCharacterAssets.get(item.id))
            .map((item) => [item.id, item.assetId])
    );
    const sceneAssets = new Map(
        draft.scenes
            .filter((item) => item.assetId !== baseSceneAssets.get(item.id))
            .map((item) => [item.id, item.assetId])
    );
    return {
        ...current,
        characters: current.characters.map((item) =>
            characterAssets.has(item.id) ? { ...item, assetId: characterAssets.get(item.id) } : item
        ),
        scenes: current.scenes.map((item) =>
            sceneAssets.has(item.id) ? { ...item, assetId: sceneAssets.get(item.id) } : item
        )
    };
}
