import { appendProjectReferenceUrls } from '@/features/generation/components/CreationForm/shot-queue';
import type { ProductionSnapshot } from '@/shared/contracts/production';
import { describe, expect, it } from 'vitest';

describe('shot queue references', () => {
    it('falls back to shot asset ids as asset references', () => {
        const snapshot = {
            version: 1,
            source: 'local-draft',
            project: {
                id: 'project-1',
                title: 'Project',
                genre: '',
                sourceLanguage: 'zh-CN',
                voiceLanguage: 'zh-CN',
                subtitleMode: 'none',
                targetRatio: '16:9',
                targetResolution: '480p',
                generationModel: 'seedance',
                watermark: false,
                basePrompt: '',
                styleNote: '',
                createdAt: 0,
                updatedAt: 0
            },
            shot: { id: 'shot-1', index: 1, count: 1, durationSeconds: 5, assetIds: ['asset-123'] },
            assetBindings: [],
            capturedAt: Date.now()
        } as ProductionSnapshot;

        expect(appendProjectReferenceUrls([], snapshot, 4)).toEqual(['asset://asset-123']);
    });
});
