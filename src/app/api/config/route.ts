import { NextResponse } from 'next/server';

/**
 * Runtime client config.
 *
 * NEXT_PUBLIC_* values are inlined at build time, which silently yields an
 * empty string whenever the build environment lacks the variable (observed on
 * Railway: the variable is set on the service, yet never reaches the build).
 * Reading it here — per request, on the server — makes the setting take effect
 * on a plain restart, with no rebuild and no chance of a stale bake-in.
 */
export const dynamic = 'force-dynamic';

function parseImageModels(value: string | undefined): string[] {
    return (value || '')
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean);
}

export function GET() {
    return NextResponse.json({
        mediaWorkerUrl: (process.env.MEDIA_WORKER_URL || process.env.NEXT_PUBLIC_MEDIA_WORKER_URL || '')
            .trim()
            .replace(/\/+$/, ''),
        transcribeModel: (process.env.TRANSCRIBE_MODEL || '').trim(),
        ttsModel: (process.env.TTS_MODEL || '').trim(),
        imageModels: parseImageModels(process.env.IMAGE_MODELS),
        portraitEnabled: Boolean(process.env.BYTEPLUS_AK && process.env.BYTEPLUS_SK)
    });
}
