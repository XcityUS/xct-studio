import type { ScriptCharacterDraft, ScriptSceneDraft, ShotDraft } from '@/features/script/types';
import { ensureShotSceneIds } from '@/features/script/scene-matching';

export type EditorShot = ShotDraft & { id: string };
export type EditorDraft = {
    shots: EditorShot[];
    script: string;
    globalNote: string;
    automatic: boolean;
    characters: ScriptCharacterDraft[];
    scenes: ScriptSceneDraft[];
};

// Browser-local editor cache, not cloud persistence or the generation queue.
const drafts = new Map<string, EditorDraft>();

const STORAGE_PREFIX = 'xctStudioStoryboardDraft:';

function isEditorDraft(value: unknown): value is EditorDraft {
    if (!value || typeof value !== 'object') return false;
    const record = value as Partial<EditorDraft>;
    return Array.isArray(record.shots) && typeof record.script === 'string';
}

export function rememberDraft(key: string, draft: EditorDraft) {
    const copy = structuredClone(draft);
    drafts.set(key, copy);
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(copy));
        } catch {
            // Keep the in-memory copy even when browser storage is unavailable or full.
        }
    }
}
export function recalledDraft(key: string): EditorDraft | undefined {
    const value = drafts.get(key);
    if (value) return structuredClone(value);
    if (typeof window === 'undefined') return undefined;
    try {
        const parsed = JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}${key}`) ?? 'null') as unknown;
        return isEditorDraft(parsed)
            ? {
                  ...parsed,
                  characters: parsed.characters ?? [],
                  scenes: parsed.scenes ?? [],
                  shots: ensureShotSceneIds(parsed.shots, parsed.scenes ?? [])
              }
            : undefined;
    } catch {
        return undefined;
    }
}
export function validShots(shots: ShotDraft[], min: number, max: number): boolean {
    return (
        shots.length > 0 &&
        shots.every(
            (shot) =>
                Boolean(shot.description.trim()) &&
                Number.isInteger(shot.durationSeconds) &&
                (shot.durationSeconds ?? 0) >= min &&
                (shot.durationSeconds ?? 0) <= max
        )
    );
}
