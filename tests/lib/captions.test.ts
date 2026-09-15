import { transcribeVideo } from '@/lib/captions';
import { afterEach, describe, expect, it, vi } from 'vitest';

function response(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

describe('caption transcription gateway client', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('calls TokenHub directly with the user key and timestamp options', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
            response({ segments: [{ start: 1, end: 2.5, text: '  Spoken line  ' }] })
        );
        vi.stubGlobal('fetch', fetchMock);

        await expect(
            transcribeVideo(new Blob(['video'], { type: 'video/mp4' }), 'user-key', 'whisper', 'https://gateway.test/v1')
        ).resolves.toEqual([{ start: 1, end: 2.5, text: 'Spoken line' }]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('https://gateway.test/v1/audio/transcriptions');
        const request = fetchMock.mock.calls[0][1];
        expect(request?.headers).toEqual({ Authorization: 'Bearer user-key' });
        const body = request?.body as FormData;
        expect(body.get('model')).toBe('whisper');
        expect(body.get('response_format')).toBe('verbose_json');
        expect(body.get('timestamp_granularities[]')).toBe('segment');
    });

    it('preserves a forbidden gateway message instead of reporting an invalid key', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn<typeof fetch>().mockResolvedValue(
                response({ error: { message: 'Key does not have access to model whisper.' } }, 403)
            )
        );

        await expect(
            transcribeVideo(new Blob(['video']), 'user-key', 'whisper', 'https://gateway.test')
        ).rejects.toThrow('Key does not have access to model whisper.');
    });
});
