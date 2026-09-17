import {
    encodeAudioExcerpt,
    prepareReferenceAudio,
    ReferenceAudioPreparationError
} from '@/features/generation/reference-audio/prepare';
import { audioTimelineSeconds, clampAudioRange, moveAudioRange } from '@/features/generation/reference-audio/range';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SOURCE_URI = 'data:audio/mpeg;base64,AA==';
const SAMPLE_RATE = 16_000;

function decodedAudio(seconds: number) {
    const samples = new Float32Array(seconds * SAMPLE_RATE);
    return {
        sampleRate: SAMPLE_RATE,
        length: samples.length,
        duration: seconds,
        numberOfChannels: 1,
        getChannelData: () => samples
    };
}

function stubBrowserAudio(seconds: number) {
    const audio = decodedAudio(seconds);
    vi.stubGlobal(
        'AudioContext',
        class {
            async decodeAudioData() {
                return audio;
            }
            async close() {}
        }
    );
    vi.stubGlobal(
        'FileReader',
        class {
            result: string | null = null;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;

            readAsDataURL(blob: Blob) {
                void blob.arrayBuffer().then(
                    (buffer) => {
                        this.result = `data:audio/wav;base64,${Buffer.from(buffer).toString('base64')}`;
                        this.onload?.();
                    },
                    () => this.onerror?.()
                );
            }
        }
    );
}

afterEach(() => vi.unstubAllGlobals());

describe('reference audio preparation', () => {
    it('clips a 31-second recording to the first 30 seconds before submission', async () => {
        stubBrowserAudio(31);
        const result = await prepareReferenceAudio(SOURCE_URI, 30);
        expect(result).toMatch(/^data:audio\/wav;base64,/);

        const bytes = Buffer.from(result.split(',')[1], 'base64');
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
        expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
        expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);
        expect(view.getUint32(40, true)).toBe(30 * SAMPLE_RATE * 2);
        expect(bytes.length).toBe(44 + 30 * SAMPLE_RATE * 2);
    });

    it('preserves a supported audio file that is already short enough', async () => {
        stubBrowserAudio(29);
        expect(await prepareReferenceAudio(SOURCE_URI, 30)).toBe(SOURCE_URI);
    });

    it('converts a short M4A input into a provider-compatible WAV', async () => {
        stubBrowserAudio(3);
        expect(await prepareReferenceAudio('data:audio/mp4;base64,AA==', 30)).toMatch(/^data:audio\/wav;base64,/);
    });

    it('also clips to a shorter selected video duration', () => {
        const bytes = encodeAudioExcerpt(decodedAudio(31), 12);
        const view = new DataView(bytes.buffer);
        expect(view.getUint32(40, true)).toBe(12 * SAMPLE_RATE * 2);
    });

    it('extracts the selected start and end instead of always taking the opening audio', async () => {
        stubBrowserAudio(31);
        const result = await prepareReferenceAudio(SOURCE_URI, 30, { startSeconds: 12, endSeconds: 30 });
        const bytes = Buffer.from(result.split(',')[1], 'base64');
        expect(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(40, true)).toBe(
            18 * SAMPLE_RATE * 2
        );
    });

    it('starts the encoded WAV at the requested source sample', () => {
        const audio = decodedAudio(4);
        audio.getChannelData().fill(0.5, 2 * SAMPLE_RATE);
        const bytes = encodeAudioExcerpt(audio, 2, 2);
        expect(new DataView(bytes.buffer).getInt16(44, true)).toBe(16384);
    });

    it('rejects a selected range that exceeds the actual audio duration', async () => {
        stubBrowserAudio(31);
        await expect(prepareReferenceAudio(SOURCE_URI, 30, { startSeconds: 20, endSeconds: 40 })).rejects.toEqual(
            new ReferenceAudioPreparationError('invalid-range')
        );
    });

    it('uses audio metadata for the timeline or a 600-second fallback', () => {
        expect(audioTimelineSeconds(211.8)).toBe(211);
        expect(audioTimelineSeconds(null)).toBe(600);
        expect(audioTimelineSeconds(Number.POSITIVE_INFINITY)).toBe(600);
        expect(clampAudioRange({ startSeconds: 40, endSeconds: 70 }, 12, 211)).toEqual({
            startSeconds: 40,
            endSeconds: 52
        });
        expect(clampAudioRange({ startSeconds: 205, endSeconds: 235 }, 30, 211)).toEqual({
            startSeconds: 205,
            endSeconds: 211
        });
        expect(moveAudioRange({ startSeconds: 0, endSeconds: 30 }, 'end', 60, 30, 211)).toEqual({
            startSeconds: 30,
            endSeconds: 60
        });
        expect(moveAudioRange({ startSeconds: 0, endSeconds: 30 }, 'start', 48, 30, 211)).toEqual({
            startSeconds: 48,
            endSeconds: 78
        });
    });

    it('rejects audio shorter than the provider minimum before submission', async () => {
        stubBrowserAudio(1);
        await expect(prepareReferenceAudio(SOURCE_URI, 30)).rejects.toEqual(
            new ReferenceAudioPreparationError('too-short')
        );
    });
});
