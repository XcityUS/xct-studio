import {
    assetIdFromReferenceUrl,
    automaticReviewOrigin,
    declarationSatisfied,
    knownReferenceStatus,
    normalizeAssetId,
    originForGeneratedImage,
    originRequiresAssetLibrary,
    originRequiresAuthorization,
    originSupportsInlineReview,
    referenceAdmissionReason,
    referenceSatisfied,
    type ReferenceDeclaration,
    type ReferenceOrigin
} from '@/features/assets/reference/origin';
import { describe, expect, it } from 'vitest';

function declaration(origin: ReferenceOrigin, extra: Partial<ReferenceDeclaration> = {}): ReferenceDeclaration {
    return { origin, declaredAt: 1, ...extra };
}

describe('reference asset admission', () => {
    it('only exempts Seedream-generated material from Asset ID admission', () => {
        expect(declarationSatisfied(declaration('byteplus-ai', { model: 'seedream-4.0' }))).toBe(true);
        expect(declarationSatisfied(declaration('byteplus-ai', { model: 'seedance-2.5' }))).toBe(false);
        expect(declarationSatisfied(declaration('no-person'))).toBe(false);
        expect(declarationSatisfied(declaration('official-asset'))).toBe(false);
        expect(declarationSatisfied(declaration('thirdparty-ai'))).toBe(false);
        expect(declarationSatisfied(declaration('real-person'))).toBe(false);
    });

    it('classifies only Seedream generation as exempt', () => {
        expect(originForGeneratedImage('seedream-4.0')).toBe('byteplus-ai');
        expect(originForGeneratedImage('byteplus/seedance-2.5')).toBe('thirdparty-ai');
    });

    it('routes unreviewed uploads to provider review without reclassifying approved or verified sources', () => {
        expect(automaticReviewOrigin(undefined)).toBe('uploaded');
        expect(automaticReviewOrigin(declaration('uploaded'))).toBe('uploaded');
        expect(automaticReviewOrigin(declaration('byteplus-ai', { model: 'seedance-2.5' }))).toBe('uploaded');
        expect(automaticReviewOrigin(declaration('byteplus-ai', { model: 'seedream-4.0' }))).toBeNull();
        expect(automaticReviewOrigin(declaration('real-person'))).toBeNull();
        expect(automaticReviewOrigin(declaration('official-asset', { assetId: 'asset-1' }))).toBeNull();
    });

    it.each(['no-person', 'official-asset', 'thirdparty-ai', 'real-person', 'public-figure', 'licensed-ip'] as const)(
        'accepts admitted %s material with an Asset ID',
        (origin) => {
            expect(declarationSatisfied(declaration(origin, { assetId: 'asset-1' }))).toBe(true);
        }
    );

    it('classifies library and authorization requirements independently', () => {
        expect(originRequiresAssetLibrary('byteplus-ai')).toBe(false);
        expect(originRequiresAssetLibrary('no-person')).toBe(true);
        expect(originRequiresAuthorization('real-person')).toBe(false);
        expect(originRequiresAuthorization('public-figure')).toBe(false);
        expect(originRequiresAuthorization('licensed-ip')).toBe(false);
        expect(originSupportsInlineReview('no-person')).toBe(true);
        expect(originSupportsInlineReview('uploaded')).toBe(true);
        expect(originSupportsInlineReview('thirdparty-ai')).toBe(true);
        expect(originSupportsInlineReview('real-person')).toBe(false);
        expect(originSupportsInlineReview('public-figure')).toBe(true);
        expect(originSupportsInlineReview('licensed-ip')).toBe(true);
    });

    it('normalizes pasted Asset IDs without accepting whitespace', () => {
        expect(normalizeAssetId(' asset://portrait-123 ')).toBe('portrait-123');
        expect(assetIdFromReferenceUrl('asset://portrait-123')).toBe('portrait-123');
        expect(assetIdFromReferenceUrl('https://example.com/image.png')).toBeUndefined();
        expect(normalizeAssetId('bad asset')).toBe('');
    });

    it('keeps an explicit Asset ID usable after its local library card is removed', () => {
        const url = 'asset://portrait-123';
        expect(referenceSatisfied(url, undefined)).toBe(true);
        expect(referenceAdmissionReason(url, undefined, 30)).toBeNull();
        expect(referenceAdmissionReason(url, undefined, 1)).toBe(
            'Current model does not support person assets. Switch to a compatible model.'
        );
        expect(knownReferenceStatus(url, [])).toBeUndefined();
    });

    it('still blocks a locally known failed or processing Asset ID', () => {
        const url = 'asset://portrait-123';
        expect(referenceSatisfied(url, undefined, undefined, 'Failed')).toBe(false);
        expect(referenceAdmissionReason(url, undefined, 30, undefined, 'Failed')).toBe(
            'Asset review failed; choose another'
        );
        expect(referenceAdmissionReason(url, undefined, 30, undefined, 'Processing')).toBe(
            'Only an active Asset ID can be used as a reference'
        );
        expect(knownReferenceStatus(url, [{ assetId: 'portrait-123', status: 'Failed' }])).toBe('Failed');
    });
});
