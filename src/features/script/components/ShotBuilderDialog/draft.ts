import type { ScriptCharacterDraft, ScriptSceneDraft, ShotDraft } from '@/features/script/types';

export type EditorShot = ShotDraft & { id: string };
export type EditorDraft = {
    shots: EditorShot[];
    script: string;
    globalNote: string;
    automatic: boolean;
    language: 'silent' | 'form';
    characters: ScriptCharacterDraft[];
    scenes: ScriptSceneDraft[];
};

// Ephemeral editor cache, not cloud persistence or the generation queue.
const drafts = new Map<string, EditorDraft>();
export function rememberDraft(key: string, draft: EditorDraft) {
    drafts.set(key, structuredClone(draft));
}
export function recalledDraft(key: string): EditorDraft | undefined {
    const value = drafts.get(key);
    return value ? structuredClone(value) : undefined;
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
