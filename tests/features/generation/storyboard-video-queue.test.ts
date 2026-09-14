import { storyboardVideoQueueItems } from '@/features/generation/components/CreationForm/storyboard-video-queue';
import type { CreationFormData } from '@/features/generation/components/CreationForm/types';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import { describe, expect, it } from 'vitest';

function draft(dialogue: string): EditorDraft {
    return {
        script: '',
        globalNote: '',
        automatic: false,
        characters: [
            {
                id: 'character-1',
                name: '林夏',
                aliases: [],
                description: '短发，白衬衫',
                evidence: [],
                presence: 'on_screen',
                major: true,
                assetId: 'asset-character-1'
            }
        ],
        scenes: [{ id: 'scene-1', name: '办公室', description: '', evidence: [], assetId: 'asset-scene-1' }],
        shots: [
            {
                id: 'shot-1',
                description: '林夏推门进入办公室',
                durationSeconds: 4,
                sceneId: 'scene-1',
                characterIds: ['character-1'],
                dialogues: [{ speakerCharacterId: 'character-1', text: dialogue }]
            }
        ]
    };
}

function queue(value: EditorDraft) {
    return storyboardVideoQueueItems({
        draft: value,
        shots: [{ shot: value.shots[0], index: 0 }],
        activeSeconds: 4,
        activeModel: 'dreamina-seedance-2-0-260128',
        titleForShot: () => 'Shot 1',
        buildSubmissionData: (prompt, seconds) => ({ prompt, seconds }) as CreationFormData
    });
}

describe('storyboard generation review gate', () => {
    it('keeps a valid shot in the generation queue', () => {
        expect(queue(draft('回来吧'))).toHaveLength(1);
    });

    it('does not enqueue a shot with dialogue longer than its duration', () => {
        expect(queue(draft('你以为我回来只是为了见你吗？这份合同从一开始就是陷阱。'))).toEqual([]);
    });

    it('does not enqueue production while character or scene assets are unbound', () => {
        const value = draft('回来吧');
        value.characters[0].assetId = undefined;
        expect(queue(value)).toEqual([]);
    });
});
