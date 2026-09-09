import { isStudioTab, studioPath, studioTabFromPathname } from '@/features/studio/routing';
import { describe, expect, it } from 'vitest';

describe('Studio surface routing', () => {
    it.each(['video', 'image', 'assets', 'community'] as const)('builds a durable path for %s', (tab) => {
        expect(isStudioTab(tab)).toBe(true);
        expect(studioPath('zh', tab)).toBe(`/zh/${tab}`);
        expect(studioTabFromPathname(`/en/${tab}`)).toBe(tab);
    });

    it('rejects unknown surfaces and falls back to video for the locale index', () => {
        expect(isStudioTab('settings')).toBe(false);
        expect(studioTabFromPathname('/zh')).toBe('video');
    });
});
