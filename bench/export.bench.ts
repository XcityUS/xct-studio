/**
 * Export paths: SRT subtitles from a transcription and an FCP7 XML timeline
 * for an NLE hand-off. Both are string builders over the whole timeline, run
 * synchronously on the main thread when the user hits Export.
 */
import { makeCaptionSegments, makeClips } from './fixtures';
import { segmentsToSrt } from '@/lib/captions';
import { buildFcp7Xml } from '@/lib/nle-export';
import { bench, describe } from 'vitest';

const shortTranscript = makeCaptionSegments(40);
const longTranscript = makeCaptionSegments(1200);
const shortTimeline = makeClips(12);
const longTimeline = makeClips(240);

describe('captions', () => {
    bench('segmentsToSrt - 40 segments', () => {
        segmentsToSrt(shortTranscript);
    });

    bench('segmentsToSrt - 1200 segments', () => {
        segmentsToSrt(longTranscript);
    });
});

describe('nle-export', () => {
    bench('buildFcp7Xml - 12 clip timeline', () => {
        buildFcp7Xml(shortTimeline);
    });

    bench('buildFcp7Xml - 240 clip timeline', () => {
        buildFcp7Xml(longTimeline);
    });
});
