import { mergeAssetBindings } from '@/features/generation/components/CreationForm/draft-bindings';
import { nextCharacterReference } from '@/features/generation/components/CreationForm/utils';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import { describe, expect, it } from 'vitest';

const character = {
    id: 'lead', name: 'Lead', aliases: [], description: '', evidence: [],
    presence: 'on_screen' as const, major: true, assetId: 'old'
};
const base: EditorDraft = {
    shots: [], script: '', globalNote: '', automatic: false,
    characters: [character], scenes: [{ id: 'room', name: 'Room', description: '', evidence: [], assetId: 'scene-old' }]
};

describe('creation form extracted helpers', () => {
    it('keeps newer script edits while merging only changed asynchronous asset bindings', () => {
        const current: EditorDraft = {
            ...base, script: 'newer script',
            characters: [{ ...character, description: 'newer description' }]
        };
        const returned: EditorDraft = {
            ...base, characters: [{ ...character, assetId: 'reviewed' }]
        };
        expect(mergeAssetBindings(current, returned, base)).toMatchObject({
            script: 'newer script',
            characters: [{ description: 'newer description', assetId: 'reviewed' }],
            scenes: [{ assetId: 'scene-old' }]
        });
    });

    it('reuses an attached reference and blocks new ones past the model limit', () => {
        expect(nextCharacterReference(['asset://one'], 'asset://one', 'Lead', 1, 'Scene')).toEqual({
            urls: ['asset://one'], prompt: 'Scene\n[Image 1] is Lead.'
        });
        expect(nextCharacterReference(['asset://one'], 'asset://two', 'Second', 1, 'Scene')).toBeNull();
        expect(nextCharacterReference([], 'asset://', 'Invalid', 1, 'Scene')).toBeNull();
    });
});
