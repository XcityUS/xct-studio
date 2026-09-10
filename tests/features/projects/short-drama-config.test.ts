import { defaultProjectInput } from '@/features/projects/storage';
import { DEFAULT_SHORT_DRAMA_MODEL, SHORT_DRAMA_MODELS } from '@/shared/config/seedance';
import { describe, expect, it } from 'vitest';

describe('short-drama project configuration', () => {
    it('excludes Seedance 1.5 and defaults to a supported short-drama model', () => {
        const modelIds = SHORT_DRAMA_MODELS.map((model) => model.id);

        expect(modelIds).not.toContain('seedance-1-5-pro-251215');
        expect(modelIds).toContain(DEFAULT_SHORT_DRAMA_MODEL);
        expect(defaultProjectInput().generationModel).toBe(DEFAULT_SHORT_DRAMA_MODEL);
    });
});
