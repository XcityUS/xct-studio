/**
 * Cost math runs per history row on every render of the history panel, and on
 * every keystroke in the create form (live price estimate).
 */
import { calculateVideoCost } from '@/lib/cost-utils';
import {
    RATIOS,
    RESOLUTIONS,
    SEEDANCE_MODELS,
    clampSeconds,
    formatSize,
    parseSize,
    pixelDimensions
} from '@/lib/seedance';
import { bench, describe } from 'vitest';

const singleUsage = {
    model: 'dreamina-seedance-2-0-260128',
    ratio: '21:9',
    resolution: '1080p',
    seconds: 8,
    generateAudio: true,
    inputVideoSeconds: 4
};

/** One row per model/ratio/resolution combination the catalog actually prices. */
const catalogUsages = SEEDANCE_MODELS.flatMap((model) =>
    RATIOS.flatMap((ratio) =>
        RESOLUTIONS.filter((resolution) => model.unitPrices[resolution] != null).map((resolution) => ({
            model: model.id,
            ratio,
            resolution,
            seconds: model.minSeconds,
            generateAudio: true,
            inputVideoSeconds: 0
        }))
    )
);

const sizeStrings = RATIOS.flatMap((ratio) => RESOLUTIONS.map((resolution) => formatSize(ratio, resolution)));

describe('cost-utils', () => {
    bench('calculateVideoCost - single job', () => {
        calculateVideoCost(singleUsage);
    });

    bench(`calculateVideoCost - full catalog (${catalogUsages.length} combinations)`, () => {
        for (const usage of catalogUsages) {
            calculateVideoCost(usage);
        }
    });

    bench('pixelDimensions - every ratio/resolution pair', () => {
        for (const ratio of RATIOS) {
            for (const resolution of RESOLUTIONS) {
                pixelDimensions(ratio, resolution);
            }
        }
    });

    bench('parseSize - display strings back to ratio/resolution', () => {
        for (const size of sizeStrings) {
            parseSize(size);
        }
    });

    bench('clampSeconds - per model bounds', () => {
        for (const model of SEEDANCE_MODELS) {
            clampSeconds(37, model.id);
            clampSeconds(1, model.id);
        }
    });
});
