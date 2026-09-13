import { ensureShotCharacterIds, inferShotCharacterIds } from '@/features/script/character-matching';
import type { ScriptCharacterDraft } from '@/features/script/types';
import { describe, expect, it } from 'vitest';

const characters: ScriptCharacterDraft[] = [{
    id: 'sister',
    name: '妹妹',
    aliases: ['Sister'],
    description: 'Young sister',
    evidence: [],
    presence: 'on_screen',
    major: true
}];

describe('shot character matching', () => {
    it('infers characters until the user makes an explicit selection', () => {
        expect(inferShotCharacterIds({ description: '妹妹走进房间' }, characters)).toEqual(['sister']);
        expect(inferShotCharacterIds({
            description: '妹妹走进房间',
            characterIds: [],
            characterSelectionMode: 'manual'
        }, characters)).toEqual([]);
    });

    it('does not restore a manually removed character while normalizing shots', () => {
        const [shot] = ensureShotCharacterIds([{
            id: 'shot-1',
            description: 'Sister waves',
            characterIds: [],
            characterSelectionMode: 'manual' as const
        }], characters);
        expect(shot.characterIds).toBeUndefined();
        expect(shot.characterSelectionMode).toBe('manual');
    });
});
