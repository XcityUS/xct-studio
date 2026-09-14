import {
    capabilityById,
    routedCapabilities,
    SCREENWRITING_CAPABILITY_CATALOG
} from '@/features/script/review/capabilities';
import { describe, expect, it } from 'vitest';

describe('screenwriting capability catalog', () => {
    it('registers every referenced source capability without duplicate ids', () => {
        expect(SCREENWRITING_CAPABILITY_CATALOG).toHaveLength(40);
        expect(new Set(SCREENWRITING_CAPABILITY_CATALOG.map((item) => item.id)).size).toBe(40);
        expect(SCREENWRITING_CAPABILITY_CATALOG.filter((item) => item.source === 'screenwriting-skills')).toHaveLength(
            25
        );
        expect(SCREENWRITING_CAPABILITY_CATALOG.filter((item) => item.source === 'inkos')).toHaveLength(15);
    });

    it('keeps overlapping InkOS writing skills discoverable but out of execution routing', () => {
        expect(capabilityById('inkos:inkos-storyboard')?.role).toBe('overlap');
        expect(routedCapabilities('storyboard').map((item) => item.id)).not.toContain('inkos:inkos-storyboard');
        expect(routedCapabilities('storyboard').map((item) => item.id)).toContain('screenwriting:sw-scene-craft');
    });

    it('only activates supplemental InkOS capabilities when a project selects them', () => {
        expect(routedCapabilities('delivery').map((item) => item.id)).not.toContain('inkos:inkos-translation');
        expect(routedCapabilities('delivery', ['inkos:inkos-translation']).map((item) => item.id)).toContain(
            'inkos:inkos-translation'
        );
    });
});
