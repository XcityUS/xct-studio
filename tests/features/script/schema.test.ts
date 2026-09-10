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

    it('maps shot character names and dialogue speakers to extracted character ids', () => {
        expect(
            normalizeScriptAnalysis({
                characters: [
                    {
                        id: 'character_1',
                        name: '林夏',
                        aliases: ['小夏'],
                        description: '二十多岁，白衬衫，神情紧张',
                        evidence: ['林夏说：行情可以止损。'],
                        major: true
                    },
                    {
                        id: 'character_2',
                        name: '陈远',
                        aliases: [],
                        description: '三十岁左右，深色夹克',
                        evidence: ['陈远沉默地看着她。'],
                        major: true
                    }
                ],
                scenes: [{ id: 'scene_1', name: '交易办公室', description: '夜晚，屏幕冷光' }],
                shots: [
                    {
                        id: 'shot_1',
                        description: '林夏和陈远在屏幕前对峙',
                        prompt: '中景，冷光，紧张对峙',
                        scene_id: 'scene_1',
                        characters: [{ name: '小夏' }, { characterName: '陈远' }],
                        dialogues: [{ speaker: '林夏', text: '行情可以止损，感情什么时候该止损？' }],
                        duration_seconds: 6
                    }
                ]
            })
        ).toMatchObject({
            shots: [
                {
                    id: 'shot_1',
                    sceneId: 'scene_1',
                    characterIds: ['character_1', 'character_2'],
                    dialogues: [{ speakerCharacterId: 'character_1' }]
                }
            ]
        });
    });

    it('maps shot scene names to extracted scene ids', () => {
        expect(
            normalizeScriptAnalysis({
                characters: [],
                scenes: [
                    { id: 'scene_1', name: '办公室 上午', description: '开放式办公室' },
                    { id: 'scene_2', name: '会议室 上午', description: '封闭会议室' }
                ],
                shots: [
                    {
                        id: 'shot_1',
                        sceneName: '会议室 上午',
                        description: '封闭会议室，核心四人在场，气氛凝重'
                    }
                ]
            }).shots
        ).toMatchObject([{ id: 'shot_1', sceneId: 'scene_2' }]);
    });
});
