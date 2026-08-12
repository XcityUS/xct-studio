import { InvalidApiKeyError } from './errors';
import { createFrontendOpenAI } from './openai-client';

export type CaptionSegment = {
    start: number;
    end: number;
    text: string;
};

function transcriptionModelUnavailableError(model: string) {
    return new Error(
        `Transcription model "${model}" is not available on the gateway. Set TRANSCRIBE_MODEL to a model your plan includes.`
    );
}

function getStatus(error: unknown) {
    if (!error || typeof error !== 'object') return undefined;
    return (error as { status?: unknown }).status;
}

function fileFromBlob(blob: Blob) {
    return new File([blob], 'assembled.mp4', { type: blob.type || 'video/mp4' });
}

export async function transcribeVideo(
    blob: Blob,
    apiKey: string,
    model: string,
    baseURL?: string
): Promise<CaptionSegment[]> {
    const client = createFrontendOpenAI(apiKey, baseURL);

    try {
        const transcription = await client.audio.transcriptions.create({
            file: fileFromBlob(blob),
            model,
            response_format: 'verbose_json',
            timestamp_granularities: ['segment']
        });

        return (transcription.segments ?? [])
            .map((segment) => ({
                start: segment.start,
                end: segment.end,
                text: segment.text.trim()
            }))
            .filter((segment) => segment.text && Number.isFinite(segment.start) && Number.isFinite(segment.end));
    } catch (error) {
        const status = getStatus(error);
        if (typeof status === 'number' && (status === 401 || status === 403)) {
            throw new InvalidApiKeyError();
        }
        if (status === 400 || status === 404) {
            throw transcriptionModelUnavailableError(model);
        }
        throw error instanceof Error ? error : new Error('Video transcription failed.');
    }
}

function formatSrtTime(value: number) {
    const totalMs = Math.max(0, Math.round(value * 1000));
    const ms = totalMs % 1000;
    const totalSeconds = Math.floor(totalMs / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

export function segmentsToSrt(segments: CaptionSegment[]): string {
    const blocks = segments
        .filter((segment) => segment.text.trim() && Number.isFinite(segment.start) && Number.isFinite(segment.end))
        .map((segment, index) => {
            const start = Math.max(0, segment.start);
            const end = Math.max(start, segment.end);
            const text = segment.text.replace(/\r/g, '').trim();

            return `${index + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${text}`;
        });

    return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}
