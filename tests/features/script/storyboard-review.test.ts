import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import { estimateDialogueSeconds, reviewStoryboard } from '@/features/script/review/storyboard';
import { describe, expect, it } from 'vitest';

const baseDraft = (): EditorDraft => ({
    script: '',
    globalNote: '',
    automatic: false,
    characters: [
        {
            id: 'character-1',
            name: '林夏',
            aliases: [],
            description: '白衬衫，短发',
            evidence: [],
            presence: 'on_screen',
            major: true,
            assetId: 'asset-character-1'
        }
    ],
    scenes: [{ id: 'scene-1', name: '办公室', description: '夜晚', evidence: [], assetId: 'asset-scene-1' }],
    shots: [
        {
            id: 'shot-1',
            description: '林夏推门进入办公室',
            durationSeconds: 5,
            sceneId: 'scene-1',
            characterIds: ['character-1']
        }
    ]
});

describe('storyboard review', () => {
    it('accepts a concrete and internally linked shot', () => {
        expect(reviewStoryboard({ draft: baseDraft(), minDurationSeconds: 2, maxDurationSeconds: 12 })).toEqual([]);
    });

    it('blocks dialogue that cannot fit in the shot', () => {
        const draft = baseDraft();
        draft.shots[0].dialogues = [
            { speakerCharacterId: 'character-1', text: '你以为我回来只是为了见你吗？这份合同从一开始就是陷阱。' }
        ];
        const findings = reviewStoryboard({ draft, minDurationSeconds: 2, maxDurationSeconds: 12 });
        expect(estimateDialogueSeconds(draft.shots[0].dialogues)).toBeGreaterThan(5);
        expect(findings).toContainEqual(expect.objectContaining({ code: 'DIALOGUE_TOO_LONG', severity: 'blocking' }));
    });

    it('blocks production while any character or scene asset is unbound', () => {
        const draft = baseDraft();
        draft.characters[0].assetId = undefined;
        draft.scenes[0].assetId = undefined;
        const codes = reviewStoryboard({ draft, minDurationSeconds: 2, maxDurationSeconds: 12 }).map(
            (item) => item.code
        );
        expect(codes).toEqual(expect.arrayContaining(['UNBOUND_CHARACTER_ASSET', 'UNBOUND_SCENE_ASSET']));
    });

    it('reports broken references and forward continuity', () => {
        const draft = baseDraft();
        draft.shots[0] = {
            ...draft.shots[0],
            sceneId: 'missing-scene',
            characterIds: ['missing-character'],
            continuitySourceShotId: 'later-shot'
        };
        draft.shots.push({ id: 'later-shot', description: '林夏回头看门外', durationSeconds: 4 });
        const codes = reviewStoryboard({ draft, minDurationSeconds: 2, maxDurationSeconds: 12 }).map(
            (item) => item.code
        );
        expect(codes).toEqual(
            expect.arrayContaining([
                'UNKNOWN_CHARACTER_REFERENCE',
                'UNKNOWN_SCENE_REFERENCE',
                'INVALID_CONTINUITY_SOURCE'
            ])
        );
    });

    it('warns when an abstract state has no visible action', () => {
        const draft = baseDraft();
        draft.shots[0].description = '林夏感到绝望和后悔';
        expect(reviewStoryboard({ draft, minDurationSeconds: 2, maxDurationSeconds: 12 })).toContainEqual(
            expect.objectContaining({ code: 'ABSTRACT_VISUAL_DESCRIPTION', severity: 'warning' })
        );
    });
});
