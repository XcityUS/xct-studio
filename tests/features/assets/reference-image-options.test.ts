import { isReferenceImagePortrait } from '@/features/assets/components/ReferenceImagesInput/utils';
import { describe, expect, it } from 'vitest';

describe('reference image asset options', () => {
    it('accepts image and legacy assets without a recorded type', () => {
        expect(isReferenceImagePortrait({ assetType: 'Image' })).toBe(true);
        expect(isReferenceImagePortrait({ assetType: undefined })).toBe(true);
    });

    it('does not put video or audio assets in an image picker', () => {
        expect(isReferenceImagePortrait({ assetType: 'Video' })).toBe(false);
        expect(isReferenceImagePortrait({ assetType: 'Audio' })).toBe(false);
    });
});
