import { titleConflict } from '@/features/projects/components/ProjectHeader/title';
import {
    recalledDraft,
    rememberDraft,
    validShots,
    type EditorDraft
} from '@/features/script/components/ShotBuilderDialog/draft';
import { inspectDraft } from '@/features/script/components/ShotBuilderDialog/preflight';
import { describe, expect, it } from 'vitest';

describe('short drama editor draft', () => {
    it('keeps project drafts isolated and does not leak mutable references', () => {
        const draft: EditorDraft = {
            shots: [{ id: 'a', description: 'A enters', durationSeconds: 5 }],
            script: 'A',
            globalNote: '',
            automatic: false,
            characters: [],
            scenes: []
        };
        rememberDraft('project-a', draft);
        draft.shots[0].description = 'changed';
        expect(recalledDraft('project-a')?.shots[0].description).toBe('A enters');
        expect(recalledDraft('project-b')).toBeUndefined();
        const read = recalledDraft('project-a')!;
        read.shots.pop();
        expect(recalledDraft('project-a')?.shots).toHaveLength(1);
    });
    it('blocks an unbound main character and only warns about a missing scene reference', () => {
        const result = inspectDraft({
            shots: [
                {
                    id: 'shot-1',
                    description: 'A enters',
                    durationSeconds: 5,
                    characterIds: ['character-1'],
                    sceneId: 'scene-1'
                }
            ],
            script: 'A enters',
            globalNote: '',
            automatic: true,
            characters: [
                {
                    id: 'character-1',
                    name: 'A',
                    aliases: [],
                    description: 'black coat',
                    evidence: [],
                    presence: 'on_screen',
                    major: true
                }
            ],
            scenes: [{ id: 'scene-1', name: 'Office', description: '', evidence: [] }]
        });
        expect(result.blocking).toEqual(['A']);
        expect(result.warnings).toEqual(['Office']);
    });
    it('rejects empty descriptions and invalid durations instead of silently filtering or clamping shots', () => {
        expect(validShots([], 2, 12)).toBe(false);
        for (const durationSeconds of [undefined, 0, 1, 13, 2.5, NaN]) {
            expect(validShots([{ description: 'A', durationSeconds }], 2, 12)).toBe(false);
        }
        expect(validShots([{ description: ' ', durationSeconds: 5 }], 2, 12)).toBe(false);
        expect(
            validShots(
                [
                    { description: 'A', durationSeconds: 2 },
                    { description: 'B', durationSeconds: 12 }
                ],
                2,
                12
            )
        ).toBe(true);
    });
    it('rejects normalized duplicates without switching to another project', () => {
        const projects = [
            { id: 'a', title: 'My  Drama' },
            { id: 'b', title: 'Next' }
        ];
        expect(titleConflict(projects, ' MY drama ')).toBe(true);
        expect(titleConflict(projects, ' MY drama ', 'a')).toBe(false);
        expect(titleConflict(projects, ' MY drama ', 'b')).toBe(true);
        expect(titleConflict(projects, 'New')).toBe(false);
    });
});
