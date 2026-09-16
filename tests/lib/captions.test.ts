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
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(response({ segments: [{ start: 1, end: 2.5, text: '  Spoken line  ' }] }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(
            transcribeVideo(
                new Blob(['video'], { type: 'video/mp4' }),
                'user-key',
                'whisper',
                'https://gateway.test/v1'
            )
        ).resolves.toEqual([{ start: 1, end: 2.5, text: 'Spoken line' }]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('https://gateway.test/v1/audio/transcriptions');
        const request = fetchMock.mock.calls[0][1];
        expect(request?.headers).toEqual({ Authorization: 'Bearer user-key' });
        const body = request?.body as FormData;
        expect(body.get('model')).toBe('whisper');
        expect(body.get('response_format')).toBe('verbose_json');
        expect(body.getAll('timestamp_granularities[]')).toEqual(['segment', 'word']);
    });

    it('prefers word timestamps when the gateway returns them', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn<typeof fetch>().mockResolvedValue(
                response({
                    words: [
                        { start: 0.42, end: 0.8, word: 'Hello' },
                        { start: 0.82, end: 1.1, word: 'world' }
                    ],
                    segments: [{ start: 0.4, end: 1.2, text: 'Hello world' }]
                })
            )
        );

        await expect(
            transcribeVideo(new Blob(['video']), 'user-key', 'whisper', 'https://gateway.test')
        ).resolves.toEqual([
            { start: 0.42, end: 0.8, text: 'Hello' },
            { start: 0.82, end: 1.1, text: 'world' }
        ]);
    });

    it('preserves a forbidden gateway message instead of reporting an invalid key', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn<typeof fetch>()
                .mockResolvedValue(response({ error: { message: 'Key does not have access to model whisper.' } }, 403))
        );

        await expect(
            transcribeVideo(new Blob(['video']), 'user-key', 'whisper', 'https://gateway.test')
        ).rejects.toThrow('Key does not have access to model whisper.');
    });
});
