import {
    MAX_SCRIPT_FILE_BYTES,
    normalizeScriptAnalysis,
    normalizeShotDrafts,
    ScriptFileError,
    validateScriptFile
} from '@/features/script/schema';
import { describe, expect, it } from 'vitest';

describe('script file validation', () => {
    it.each(['story.txt', 'story.MD', 'story.doc', 'story.docx', 'story.pdf'])('accepts %s', (filename) => {
        expect(validateScriptFile(filename, 128)).toBe(filename.split('.').pop()?.toLowerCase());
    });

    it('rejects unsupported and oversized files with stable codes', () => {
        expect(() => validateScriptFile('story.rtf', 128)).toThrowError(ScriptFileError);
        try {
            validateScriptFile('story.txt', MAX_SCRIPT_FILE_BYTES + 1);
        } catch (error) {
            expect(error).toMatchObject({ code: 'FILE_TOO_LARGE' });
        }
    });
});

describe('shot breakdown normalization', () => {
    it('normalizes the object response and removes empty optional fields', () => {
        expect(
            normalizeShotDrafts({
                shots: [{ description: '  Hero enters  ', camera: ' tracking ', audio: '  ', durationSeconds: 4 }]
            })
        ).toEqual([{ id: 'shot_draft_1', description: 'Hero enters', camera: 'tracking', durationSeconds: 4 }]);
    });

    it('rejects malformed shots', () => {
        expect(() => normalizeShotDrafts({ shots: [{ camera: 'pan' }] })).toThrow('missing a description');
    });

    it('keeps character and scene identities linkable from shots', () => {
        expect(
            normalizeScriptAnalysis({
                characters: [
                    {
                        id: 'character_1',
                        name: '李雪',
                        description: '黑色短发，深蓝外套',
                        aliases: ['小雪'],
                        evidence: ['李雪推门进入'],
                        major: true
                    }
                ],
                scenes: [{ id: 'scene_1', name: '办公室', description: '冷色办公室' }],
                shots: [
                    {
                        id: 'shot_1',
                        description: '李雪进入办公室',
                        prompt: '中景，冷色电影光',
                        sceneId: 'scene_1',
                        characterIds: ['character_1'],
                        durationSeconds: 5
                    }
                ]
            })
        ).toMatchObject({
            characters: [{ id: 'character_1', major: true }],
            scenes: [{ id: 'scene_1' }],
            shots: [{ id: 'shot_1', sceneId: 'scene_1', characterIds: ['character_1'] }]
        });
    });
});
