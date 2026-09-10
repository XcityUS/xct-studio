import type { EditorDraft } from './draft';

export type DraftPreflight = {
    blocking: string[];
    warnings: string[];
};

export function inspectDraft(draft: EditorDraft): DraftPreflight {
    const usedCharacterIds = new Set(draft.shots.flatMap((shot) => shot.characterIds ?? []));
    const usedSceneIds = new Set(draft.shots.map((shot) => shot.sceneId).filter((id): id is string => Boolean(id)));
    const relevantCharacters = draft.characters.filter(
        (character) => usedCharacterIds.size === 0 || usedCharacterIds.has(character.id)
    );
    const blocking = relevantCharacters
        .filter((character) => character.major && !character.assetId)
        .map((character) => character.name);
    const warnings = [
        ...relevantCharacters
            .filter((character) => !character.major && !character.assetId)
            .map((character) => character.name),
        ...draft.scenes
            .filter((scene) => (usedSceneIds.size === 0 || usedSceneIds.has(scene.id)) && !scene.assetId)
            .map((scene) => scene.name)
    ];
    return { blocking, warnings };
}
