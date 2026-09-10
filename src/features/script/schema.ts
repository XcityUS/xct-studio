import type {
    ScriptAnalysisDraft,
    ScriptCharacterDraft,
    ScriptDialogueDraft,
    ScriptSceneDraft,
    ShotDraft
} from '@/features/script/types';
import { inferShotSceneId, resolveSceneId } from './scene-matching';

export const MAX_SCRIPT_FILE_BYTES = 20 * 1024 * 1024;

const SUPPORTED_SCRIPT_EXTENSIONS = new Set(['txt', 'md', 'doc', 'docx', 'pdf']);

export class ScriptFileError extends Error {
    constructor(
        message: string,
        public readonly code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE' | 'EMPTY_FILE' | 'EXTRACTION_FAILED'
    ) {
        super(message);
        this.name = 'ScriptFileError';
    }
}

export function scriptFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function validateScriptFile(filename: string, size: number): string {
    if (size <= 0) {
        throw new ScriptFileError('The selected script file is empty.', 'EMPTY_FILE');
    }
    if (size > MAX_SCRIPT_FILE_BYTES) {
        throw new ScriptFileError('The script file must be 20 MB or smaller.', 'FILE_TOO_LARGE');
    }

    const extension = scriptFileExtension(filename);
    if (!SUPPORTED_SCRIPT_EXTENSIONS.has(extension)) {
        throw new ScriptFileError(
            'Supported script formats are TXT, Markdown, DOC, DOCX, and PDF.',
            'UNSUPPORTED_FILE'
        );
    }
    return extension;
}

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function texts(value: unknown): string[] {
    return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function referenceTexts(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (typeof item === 'string') return text(item) ? [text(item)] : [];
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        return [
            text(record.id),
            text(record.characterId),
            text(record.character_id),
            text(record.characterName),
            text(record.character_name),
            text(record.name)
        ].filter(Boolean);
    });
}

function referenceKey(value: string): string {
    return value.trim().toLowerCase();
}

function characterLookup(characters: ScriptCharacterDraft[]): Map<string, string> {
    const lookup = new Map<string, string>();
    characters.forEach((character) => {
        [character.id, character.name, ...character.aliases].forEach((value) => {
            const key = referenceKey(value);
            if (key) lookup.set(key, character.id);
        });
    });
    return lookup;
}

function normalizeReferenceIds(values: string[], lookup: Map<string, string>): string[] {
    return Array.from(new Set(values.map((value) => lookup.get(referenceKey(value)) ?? text(value)).filter(Boolean)));
}

function normalizeDialogues(value: unknown, lookup = new Map<string, string>()): ScriptDialogueDraft[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        const dialogueText = text(record.text);
        if (!dialogueText) return [];
        const speakerReference = [
            text(record.speakerCharacterId),
            text(record.speaker_character_id),
            text(record.speaker),
            text(record.speakerName),
            text(record.speaker_name),
            text(record.character),
            text(record.characterName),
            text(record.character_name)
        ].find(Boolean);
        const speakerCharacterId = speakerReference
            ? lookup.get(referenceKey(speakerReference)) ?? speakerReference
            : '';
        return [
            {
                text: dialogueText,
                ...(speakerCharacterId ? { speakerCharacterId } : {}),
                ...(text(record.emotion) ? { emotion: text(record.emotion) } : {})
            }
        ];
    });
}

export function normalizeShotDrafts(value: unknown, characters: ScriptCharacterDraft[] = [], scenes: ScriptSceneDraft[] = []): ShotDraft[] {
    const source = Array.isArray(value)
        ? value
        : value && typeof value === 'object' && Array.isArray((value as { shots?: unknown }).shots)
          ? (value as { shots: unknown[] }).shots
          : null;
    if (!source?.length) throw new Error('The model response did not include any shots.');

    const lookup = characterLookup(characters);
    return source.slice(0, 80).map((item, index) => {
        if (!item || typeof item !== 'object') throw new Error(`Shot ${index + 1} is invalid.`);
        const record = item as Record<string, unknown>;
        const description = text(record.description);
        if (!description) throw new Error(`Shot ${index + 1} is missing a description.`);
        const camera = text(record.camera);
        const audio = text(record.audio ?? record.audioPrompt);
        const prompt = text(record.prompt);
        const id = text(record.id) || `shot_draft_${index + 1}`;
        const durationRaw = record.durationSeconds ?? record.duration_seconds ?? record.seconds;
        const duration = typeof durationRaw === 'number' ? durationRaw : Number(durationRaw);
        const characterIds = normalizeReferenceIds(
            [
                ...texts(record.characterIds),
                ...texts(record.character_ids),
                ...texts(record.characterNames),
                ...texts(record.character_names),
                ...referenceTexts(record.characters),
                ...normalizeDialogues(record.dialogues, lookup).flatMap((dialogue) =>
                    dialogue.speakerCharacterId ? [dialogue.speakerCharacterId] : []
                )
            ],
            lookup
        );
        const dialogues = normalizeDialogues(record.dialogues, lookup);
        const shot = {
            id,
            description,
            ...(prompt ? { prompt } : {}),
            ...(camera ? { camera } : {}),
            ...(audio ? { audio } : {}),
            ...(Number.isFinite(duration) && duration > 0 ? { durationSeconds: Math.round(duration) } : {}),
            ...(characterIds.length ? { characterIds } : {}),
            ...(dialogues.length ? { dialogues } : {}),
            ...(text(record.subtitle) ? { subtitle: text(record.subtitle) } : {}),
            ...(text(record.continuitySourceShotId ?? record.continuity_source_shot_id)
                ? { continuitySourceShotId: text(record.continuitySourceShotId ?? record.continuity_source_shot_id) }
                : {})
        };
        const sceneReference = text(record.sceneId ?? record.scene_id ?? record.sceneName ?? record.scene_name ?? record.scene ?? record.location);
        const sceneId = sceneReference ? resolveSceneId(sceneReference, scenes) ?? sceneReference : inferShotSceneId(shot, scenes);
        return sceneId ? { ...shot, sceneId } : shot;
    });
}

function normalizeCharacters(value: unknown): ScriptCharacterDraft[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 60).flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        const name = text(record.name);
        const description = text(record.description);
        if (!name || !description) return [];
        const presence = record.presence;
        return [
            {
                id: text(record.id) || `character_draft_${index + 1}`,
                name,
                aliases: texts(record.aliases),
                description,
                evidence: texts(record.evidence),
                presence:
                    presence === 'voice_over' || presence === 'narrator' || presence === 'mentioned'
                        ? presence
                        : 'on_screen',
                major: record.major === true,
                ...(text(record.assetId ?? record.asset_id ?? record.projectAssetId ?? record.project_asset_id)
                    ? { assetId: text(record.assetId ?? record.asset_id ?? record.projectAssetId ?? record.project_asset_id) }
                    : {})
            }
        ];
    });
}

function normalizeScenes(value: unknown): ScriptSceneDraft[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 60).flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        const name = text(record.name);
        if (!name) return [];
        return [
            {
                id: text(record.id) || `scene_draft_${index + 1}`,
                name,
                description: text(record.description),
                evidence: texts(record.evidence),
                ...(text(record.assetId ?? record.asset_id ?? record.projectAssetId ?? record.project_asset_id)
                    ? { assetId: text(record.assetId ?? record.asset_id ?? record.projectAssetId ?? record.project_asset_id) }
                    : {})
            }
        ];
    });
}

export function normalizeScriptAnalysis(value: unknown): ScriptAnalysisDraft {
    if (!value || typeof value !== 'object') throw new Error('The model response was not an analysis object.');
    const record = value as Record<string, unknown>;
    const characters = normalizeCharacters(record.characters);
    const scenes = normalizeScenes(record.scenes);
    const shots = normalizeShotDrafts(record.shots, characters, scenes);
    return { version: 1, characters, scenes, shots };
}
