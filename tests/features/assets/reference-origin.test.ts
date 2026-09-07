import {
    assetIdFromReferenceUrl,
    declarationSatisfied,
    normalizeAssetId,
    originRequiresAssetLibrary,
    originRequiresAuthorization,
    originSupportsInlineReview,
    type ReferenceDeclaration,
    type ReferenceOrigin
} from '@/features/assets/reference/origin';
import { describe, expect, it } from 'vitest';

function declaration(origin: ReferenceOrigin, extra: Partial<ReferenceDeclaration> = {}): ReferenceDeclaration {
    return { origin, declaredAt: 1, ...extra };
}

describe('reference asset admission', () => {
    it('only exempts Studio or Seedream generated material from Asset ID admission', () => {
        expect(declarationSatisfied(declaration('byteplus-ai'))).toBe(true);
        expect(declarationSatisfied(declaration('no-person'))).toBe(false);
        expect(declarationSatisfied(declaration('official-asset'))).toBe(false);
        expect(declarationSatisfied(declaration('thirdparty-ai'))).toBe(false);
        expect(declarationSatisfied(declaration('real-person'))).toBe(false);
    });

    it.each(['no-person', 'official-asset', 'thirdparty-ai', 'real-person'] as const)(
        'accepts admitted %s material with an Asset ID',
        (origin) => {
            expect(declarationSatisfied(declaration(origin, { assetId: 'asset-1' }))).toBe(true);
        }
    );

    it.each(['public-figure', 'licensed-ip'] as const)(
        'requires both an Asset ID and approved authorization for %s',
        (origin) => {
            const approved = new Set(['auth-1']);
            expect(declarationSatisfied(declaration(origin, { authorizationId: 'auth-1' }), approved)).toBe(false);
            expect(declarationSatisfied(declaration(origin, { assetId: 'asset-1' }), approved)).toBe(false);
            expect(
                declarationSatisfied(declaration(origin, { assetId: 'asset-1', authorizationId: 'auth-1' }), approved)
            ).toBe(true);
        }
    );

    it('classifies library and authorization requirements independently', () => {
        expect(originRequiresAssetLibrary('byteplus-ai')).toBe(false);
        expect(originRequiresAssetLibrary('no-person')).toBe(true);
        expect(originRequiresAuthorization('real-person')).toBe(false);
        expect(originRequiresAuthorization('public-figure')).toBe(true);
        expect(originRequiresAuthorization('licensed-ip')).toBe(true);
        expect(originSupportsInlineReview('no-person')).toBe(true);
        expect(originSupportsInlineReview('thirdparty-ai')).toBe(true);
        expect(originSupportsInlineReview('real-person')).toBe(false);
        expect(originSupportsInlineReview('licensed-ip')).toBe(false);
    });

    it('normalizes pasted Asset IDs without accepting whitespace', () => {
        expect(normalizeAssetId(' asset://portrait-123 ')).toBe('portrait-123');
        expect(assetIdFromReferenceUrl('asset://portrait-123')).toBe('portrait-123');
        expect(assetIdFromReferenceUrl('https://example.com/image.png')).toBeUndefined();
        expect(normalizeAssetId('bad asset')).toBe('');
    });
});
