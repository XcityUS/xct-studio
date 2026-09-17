import { MIN_AUDIO_RANGE_SECONDS, type AudioRange } from './range';

const MIN_REFERENCE_AUDIO_SECONDS = MIN_AUDIO_RANGE_SECONDS;
const MIN_WAV_SAMPLE_RATE = 16_000;
const MAX_WAV_SAMPLE_RATE = 48_000;
const WAV_HEADER_BYTES = 44;

export class ReferenceAudioPreparationError extends Error {
    constructor(readonly kind: 'too-short' | 'unreadable' | 'invalid-range') {
        super(kind);
        this.name = 'ReferenceAudioPreparationError';
    }
}

type DecodedAudio = Pick<AudioBuffer, 'sampleRate' | 'length' | 'numberOfChannels' | 'getChannelData'>;

function audioBytes(dataUri: string): ArrayBuffer {
    const match = /^data:audio\/[^;,]+;base64,(.+)$/i.exec(dataUri);
    if (!match) throw new ReferenceAudioPreparationError('unreadable');
    const binary = atob(match[1]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
}

function writeTag(view: DataView, offset: number, tag: string) {
    for (let index = 0; index < tag.length; index++) view.setUint8(offset + index, tag.charCodeAt(index));
}

/** Encode only the opening samples as provider-compatible PCM WAV. */
export function encodeAudioExcerpt(audio: DecodedAudio, seconds: number, startSeconds = 0): Uint8Array {
    const sampleRate = Math.max(MIN_WAV_SAMPLE_RATE, Math.min(audio.sampleRate, MAX_WAV_SAMPLE_RATE));
    const channelCount = Math.min(audio.numberOfChannels, 2);
    const startFrame = Math.floor(startSeconds * audio.sampleRate);
    const frameCount = Math.min(
        Math.floor(seconds * sampleRate),
        Math.floor(((audio.length - startFrame) * sampleRate) / audio.sampleRate)
    );
    if (!Number.isFinite(frameCount) || frameCount <= 0 || channelCount <= 0) {
        throw new ReferenceAudioPreparationError('unreadable');
    }

    const bytes = new Uint8Array(WAV_HEADER_BYTES + frameCount * channelCount * 2);
    const view = new DataView(bytes.buffer);
    writeTag(view, 0, 'RIFF');
    view.setUint32(4, bytes.length - 8, true);
    writeTag(view, 8, 'WAVE');
    writeTag(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channelCount * 2, true);
    view.setUint16(32, channelCount * 2, true);
    view.setUint16(34, 16, true);
    writeTag(view, 36, 'data');
    view.setUint32(40, bytes.length - WAV_HEADER_BYTES, true);

    const channels = Array.from({ length: channelCount }, (_, index) => audio.getChannelData(index));
    for (let frame = 0; frame < frameCount; frame++) {
        const sourcePosition = startFrame + (frame * audio.sampleRate) / sampleRate;
        const before = Math.floor(sourcePosition);
        const fraction = sourcePosition - before;
        for (let channel = 0; channel < channelCount; channel++) {
            const samples = channels[channel];
            const sample =
                samples[before] + ((samples[Math.min(before + 1, audio.length - 1)] ?? 0) - samples[before]) * fraction;
            const normalized = Math.max(-1, Math.min(1, sample));
            view.setInt16(
                WAV_HEADER_BYTES + (frame * channelCount + channel) * 2,
                Math.round(normalized * 32767),
                true
            );
        }
    }
    return bytes;
}

function wavDataUri(bytes: Uint8Array): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new ReferenceAudioPreparationError('unreadable'));
        };
        reader.onerror = () => reject(new ReferenceAudioPreparationError('unreadable'));
        reader.readAsDataURL(new Blob([bytes], { type: 'audio/wav' }));
    });
}

export async function prepareReferenceAudio(dataUri: string, maxSeconds: number, range?: AudioRange): Promise<string> {
    if (!Number.isFinite(maxSeconds) || maxSeconds < MIN_REFERENCE_AUDIO_SECONDS) {
        throw new ReferenceAudioPreparationError('unreadable');
    }

    let audio: AudioBuffer;
    let context: AudioContext | undefined;
    try {
        context = new AudioContext();
        audio = await context.decodeAudioData(audioBytes(dataUri));
    } catch {
        throw new ReferenceAudioPreparationError('unreadable');
    } finally {
        if (context) await context.close().catch(() => {});
    }

    if (audio.duration < MIN_REFERENCE_AUDIO_SECONDS) {
        throw new ReferenceAudioPreparationError('too-short');
    }
    const startSeconds = range?.startSeconds ?? 0;
    const requestedSeconds = range ? range.endSeconds - startSeconds : maxSeconds;
    if (
        !Number.isFinite(startSeconds) ||
        !Number.isFinite(requestedSeconds) ||
        startSeconds < 0 ||
        requestedSeconds < MIN_REFERENCE_AUDIO_SECONDS ||
        requestedSeconds > maxSeconds ||
        (range && range.endSeconds > audio.duration + 0.01)
    ) {
        throw new ReferenceAudioPreparationError('invalid-range');
    }
    const isProviderFormat = /^data:audio\/(?:mpeg|mp3|wav|x-wav|wave);base64,/i.test(dataUri);
    if (startSeconds === 0 && audio.duration <= requestedSeconds && isProviderFormat) return dataUri;

    try {
        return await wavDataUri(encodeAudioExcerpt(audio, requestedSeconds, startSeconds));
    } catch {
        throw new ReferenceAudioPreparationError('unreadable');
    }
}
