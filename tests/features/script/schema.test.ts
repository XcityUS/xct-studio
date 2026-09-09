import {
    MAX_SCRIPT_FILE_BYTES,
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
        ).toEqual([{ description: 'Hero enters', camera: 'tracking', durationSeconds: 4 }]);
    });

    it('rejects malformed shots', () => {
        expect(() => normalizeShotDrafts({ shots: [{ camera: 'pan' }] })).toThrow('missing a description');
    });
});
