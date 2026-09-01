/**
 * Reference keys and compliance checks: the create form re-derives a key for
 * every attached reference image (up to 30 on Seedance 2.5) on each render,
 * and the compliance gate is evaluated on every prompt change.
 */
import {
    declarationBlockReason,
    declarationSatisfied,
    originForGeneratedImage,
    refKey,
    type ReferenceDeclaration
} from '@/lib/reference-origin';
import { bench, describe } from 'vitest';

const urls = Array.from({ length: 240 }, (_, i) => {
    const hash = i.toString(16).padStart(32, '0');
    switch (i % 4) {
        case 0:
            return `https://media.xcity.one/media/u/user-1/refs/${hash}.png?v=3#frag`;
        case 1:
            return `asset://portrait-${i}`;
        case 2:
            return `https://cdn.example.com/renders/${i}.jpg?signature=abc&expires=123`;
        default:
            return `/media/k/key-1/refs/${hash}.webp`;
    }
});

const declarations: (ReferenceDeclaration | undefined)[] = urls.map((_, i) => {
    switch (i % 5) {
        case 0:
            return { origin: 'no-person', declaredAt: 1 };
        case 1:
            return { origin: 'byteplus-ai', declaredAt: 2 };
        case 2:
            return { origin: 'thirdparty-ai', declaredAt: 3, assetId: `asset-${i}` };
        case 3:
            return { origin: 'licensed-ip', declaredAt: 4, authorizationId: `auth-${i % 20}` };
        default:
            return undefined;
    }
});

const approvedAuthorizationIds = new Set(Array.from({ length: 10 }, (_, i) => `auth-${i}`));
const models = ['seedream-5-0-260128', 'byteplus/dreamina-seedance-2-0-260128', 'imagen-4', undefined];

describe('reference-origin', () => {
    bench('refKey - 240 mixed reference urls', () => {
        for (const url of urls) {
            refKey(url);
        }
    });

    bench('declarationSatisfied - 240 declarations', () => {
        for (const declaration of declarations) {
            declarationSatisfied(declaration, approvedAuthorizationIds);
        }
    });

    bench('declarationBlockReason - 240 declarations', () => {
        for (const declaration of declarations) {
            declarationBlockReason(declaration, approvedAuthorizationIds);
        }
    });

    bench('originForGeneratedImage - model id matching', () => {
        for (const model of models) {
            originForGeneratedImage(model);
        }
    });
});
