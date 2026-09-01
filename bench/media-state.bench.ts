/**
 * Media state resolution runs for every history row on every render, and the
 * archive reconciler re-scans the whole history on a timer.
 */
import { makeHistoryItem } from './fixtures';
import { providerLinkLikelyDead, providerUrlExpiresAtMs, resolveMediaState } from '@/lib/media-state';
import { bench, describe } from 'vitest';

const NOW = 1_740_100_000_000;

const items = Array.from({ length: 500 }, (_, i) =>
    makeHistoryItem(i, {
        status: i % 7 === 0 ? 'processing' : 'completed',
        storedUrl: i % 4 === 0 ? `https://media.xcity.one/media/u/user-1/vid/${i}.mp4` : undefined
    })
);
const withBlob = { hasBlob: true };
const withoutBlob = { hasBlob: false };
const providerUrls = items.map((item) => item.providerUrl);

describe('media-state', () => {
    bench('resolveMediaState - 500 history rows', () => {
        for (let i = 0; i < items.length; i += 1) {
            resolveMediaState(items[i], i % 9 === 0 ? withBlob : withoutBlob, NOW);
        }
    });

    bench('providerUrlExpiresAtMs - 500 signed provider urls', () => {
        for (const url of providerUrls) {
            providerUrlExpiresAtMs(url);
        }
    });

    bench('providerLinkLikelyDead - 500 history rows', () => {
        for (const item of items) {
            providerLinkLikelyDead(item, NOW);
        }
    });
});
