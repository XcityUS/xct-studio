import { GET } from '@/app/api/config/route';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

afterEach(() => vi.unstubAllEnvs());

describe('runtime configuration boundary', () => {
    it('preserves the public contract and never serializes private configuration', async () => {
        vi.stubEnv('MEDIA_WORKER_URL', ' https://media.example/// ');
        vi.stubEnv('NEXT_PUBLIC_MEDIA_WORKER_URL', 'https://fallback.example');
        vi.stubEnv('TRANSCRIBE_MODEL', ' transcription-fixture ');
        vi.stubEnv('TTS_MODEL', ' speech-fixture ');
        vi.stubEnv('IMAGE_MODELS', ' model-one, ,model-two ');
        vi.stubEnv('BYTEPLUS_AK', 'test-access-key');
        vi.stubEnv('BYTEPLUS_SK', 'test-secret-key');
        vi.stubEnv('PROVIDER_ASSETS_ENABLED', 'true');

        const response = GET();
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toEqual({
            mediaWorkerUrl: 'https://media.example',
            transcribeModel: 'transcription-fixture',
            ttsModel: 'speech-fixture',
            imageModels: ['model-one', 'model-two'],
            portraitEnabled: true
        });
    });

    it('returns disabled optional capabilities when configuration is absent', async () => {
        for (const name of [
            'MEDIA_WORKER_URL',
            'NEXT_PUBLIC_MEDIA_WORKER_URL',
            'TRANSCRIBE_MODEL',
            'TTS_MODEL',
            'IMAGE_MODELS',
            'BYTEPLUS_AK',
            'BYTEPLUS_SK',
            'PROVIDER_ASSETS_ENABLED'
        ]) {
            vi.stubEnv(name, '');
        }
        expect(await GET().json()).toEqual({
            mediaWorkerUrl: '',
            transcribeModel: '',
            ttsModel: '',
            imageModels: [],
            portraitEnabled: false
        });
    });

    it('reads changed server settings on the next request and supports the legacy Worker fallback', async () => {
        vi.stubEnv('MEDIA_WORKER_URL', '');
        vi.stubEnv('NEXT_PUBLIC_MEDIA_WORKER_URL', 'https://legacy.example/');
        expect((await GET().json()).mediaWorkerUrl).toBe('https://legacy.example');
        vi.stubEnv('MEDIA_WORKER_URL', 'https://new.example/');
        expect((await GET().json()).mediaWorkerUrl).toBe('https://new.example');
    });
});
