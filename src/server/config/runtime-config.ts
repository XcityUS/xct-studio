import type { RuntimeConfig } from '@/shared/contracts/runtime-config';
import 'server-only';

export function getRuntimeConfig(): RuntimeConfig {
    // Explicit projection: only these browser-safe fields may leave the server.
    return {
        mediaWorkerUrl: (process.env.MEDIA_WORKER_URL || process.env.NEXT_PUBLIC_MEDIA_WORKER_URL || '')
            .trim()
            .replace(/\/+$/, ''),
        transcribeModel: (process.env.TRANSCRIBE_MODEL || '').trim(),
        ttsModel: (process.env.TTS_MODEL || '').trim(),
        imageModels: (process.env.IMAGE_MODELS || '')
            .split(',')
            .map((model) => model.trim())
            .filter(Boolean),
        portraitEnabled: process.env.PROVIDER_ASSETS_ENABLED === 'true'
    };
}
