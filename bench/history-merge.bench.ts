/**
 * Cloud sync merge: runs on every push/pull of the studio document, over the
 * whole history of a user (hundreds of items plus declarations/tombstones).
 */
import { makeDeclarations, makeDocPair } from './fixtures';
import { mergeDocs, sameDocContent, withDeclarations, withTombstones } from '@/lib/history-merge';
import { bench, describe } from 'vitest';

const smallPair = makeDocPair(50);
const largePair = makeDocPair(500);
const mergedOnce = mergeDocs(largePair.local, largePair.remote);
const declarations = makeDeclarations(2000);
const existingTombstones = Array.from({ length: 480 }, (_, i) => `video-deleted-local-${i}`);
const incomingTombstones = Array.from({ length: 60 }, (_, i) => `video-deleted-remote-${i}`);

describe('history-merge', () => {
    bench('mergeDocs - 50 items per device', () => {
        mergeDocs(smallPair.local, smallPair.remote);
    });

    bench('mergeDocs - 500 items per device', () => {
        mergeDocs(largePair.local, largePair.remote);
    });

    bench('sameDocContent - identical large docs', () => {
        sameDocContent(mergedOnce, mergedOnce);
    });

    bench('sameDocContent - diverging large docs', () => {
        sameDocContent(mergedOnce, largePair.remote);
    });

    bench('withTombstones - over the 500 id cap', () => {
        withTombstones(existingTombstones, incomingTombstones);
    });

    bench('withDeclarations - trim 2000 declarations to the cap', () => {
        withDeclarations(declarations);
    });
});
