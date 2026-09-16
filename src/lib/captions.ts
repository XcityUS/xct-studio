import { InvalidApiKeyError, sanitizeStudioErrorMessage } from '../shared/errors';

export type CaptionSegment = {
    start: number;
    end: number;
    text: string;
};

function fileFromBlob(blob: Blob) {
    return new File([blob], 'assembled.mp4', { type: blob.type || 'video/mp4' });
}

function transcriptionUrl(baseURL?: string) {
    const base = (baseURL || 'https://tokenhub.xcity.one/v1').trim().replace(/\/+$/, '');
    return `${base.endsWith('/v1') ? base : `${base}/v1`}/audio/transcriptions`;
}

function errorMessage(payload: unknown) {
    if (!payload || typeof payload !== 'object') return undefined;
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
        return sanitizeStudioErrorMessage((error as { message: string }).message);
    }
    return undefined;
}

export async function transcribeVideo(
    blob: Blob,
    apiKey: string,
    model: string,
    baseURL?: string
): Promise<CaptionSegment[]> {
    const body = new FormData();
    body.append('file', fileFromBlob(blob));
    body.append('model', model);
    body.append('response_format', 'verbose_json');
    body.append('timestamp_granularities[]', 'segment');
    body.append('timestamp_granularities[]', 'word');
    const response = await fetch(transcriptionUrl(baseURL), {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body
    });
    const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: unknown };
        segments?: CaptionSegment[];
        words?: Array<{ start?: unknown; end?: unknown; word?: unknown; text?: unknown }>;
    };
    if (!response.ok) {
        const message = errorMessage(payload);
        if (response.status === 401) throw new InvalidApiKeyError(message || 'Invalid Xcity API key');
        if (response.status === 403) {
            throw new Error(message || `Your Xcity API key does not have access to model "${model}".`);
        }
        throw new Error(message);
    }
    const timedWords = Array.isArray(payload.words)
        ? payload.words.flatMap((value): CaptionSegment[] => {
              if (!value || typeof value !== 'object') return [];
              const start = Number(value.start);
              const end = Number(value.end);
              const text =
                  typeof value.word === 'string'
                      ? value.word.trim()
                      : typeof value.text === 'string'
                        ? value.text.trim()
                        : '';
              return text && Number.isFinite(start) && Number.isFinite(end) && end >= start
                  ? [{ start, end, text }]
                  : [];
          })
        : [];
    if (timedWords.length > 0) return timedWords;
    if (!Array.isArray(payload.segments)) {
        throw new Error('Transcription response did not include segment timestamps.');
    }
    return payload.segments.flatMap((value) => {
        if (!value || typeof value !== 'object') return [];
        const segment = value as { start?: unknown; end?: unknown; text?: unknown };
        const start = Number(segment.start);
        const end = Number(segment.end);
        const text = typeof segment.text === 'string' ? segment.text.trim() : '';
        return text && Number.isFinite(start) && Number.isFinite(end) && end >= start ? [{ start, end, text }] : [];
    });
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
