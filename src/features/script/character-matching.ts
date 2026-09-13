import type { ScriptCharacterDraft, ShotDraft } from './types';

function normalize(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, '');
}

function isUsefulTerm(value: string) {
    const term = normalize(value);
    if (!term) return false;
    if (/[\u3400-\u9fff]/.test(term)) return term.length >= 2;
    return term.length >= 3;
}

function characterTerms(character: ScriptCharacterDraft) {
    return [character.id, character.name, ...character.aliases]
        .map((value) => value.trim())
        .filter(isUsefulTerm);
}

function shotText(shot: Pick<ShotDraft, 'description' | 'prompt' | 'camera' | 'audio' | 'subtitle' | 'dialogues'>) {
    return normalize([
        shot.prompt,
        shot.description,
        shot.camera,
        shot.audio,
        shot.subtitle,
        ...(shot.dialogues?.flatMap((dialogue) => [dialogue.text, dialogue.speakerCharacterId]) ?? [])
    ].filter(Boolean).join(' '));
}

export function resolveCharacterId(reference: string, characters: ScriptCharacterDraft[]) {
    const key = normalize(reference);
    if (!key) return undefined;
    const exact = characters.find((character) =>
        [character.id, character.name, ...character.aliases].some((value) => normalize(value) === key)
    );
    return exact?.id;
}

export function inferShotCharacterIds(
    shot: Pick<ShotDraft, 'characterIds' | 'characterSelectionMode' | 'description' | 'prompt' | 'camera' | 'audio' | 'subtitle' | 'dialogues'>,
    characters: ScriptCharacterDraft[]
) {
    const ids = new Set<string>();
    if (shot.characterSelectionMode === 'manual') {
        for (const id of shot.characterIds ?? []) {
            const resolved = resolveCharacterId(id, characters);
            if (resolved) ids.add(resolved);
        }
        return Array.from(ids);
    }
    const text = shotText(shot);
    for (const id of shot.characterIds ?? []) {
        const resolved = resolveCharacterId(id, characters);
        if (resolved) ids.add(resolved);
    }
    for (const dialogue of shot.dialogues ?? []) {
        const resolved = dialogue.speakerCharacterId ? resolveCharacterId(dialogue.speakerCharacterId, characters) : undefined;
        if (resolved) ids.add(resolved);
    }
    if (text) {
        for (const character of characters) {
            if (character.presence !== 'on_screen') continue;
            if (characterTerms(character).some((term) => text.includes(normalize(term)))) ids.add(character.id);
        }
    }
    return Array.from(ids);
}

export function ensureShotCharacterIds<T extends ShotDraft>(shots: T[], characters: ScriptCharacterDraft[]): T[] {
    return shots.map((shot) => {
        const characterIds = inferShotCharacterIds(shot, characters);
        if (!characterIds.length) {
            const rest = { ...shot };
            delete rest.characterIds;
            return rest as T;
        }
        return { ...shot, characterIds };
    });
}
