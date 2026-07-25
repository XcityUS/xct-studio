import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Lazy: constructing the client at module scope throws at build time
// (page-data collection) when OPENAI_API_KEY is absent from the build env.
function getOpenAI(): OpenAI {
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_API_BASE_URL
    });
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
    console.log('Received POST request to /api/videos');

    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set.');
        return NextResponse.json({ error: 'Server configuration error: API key not found.' }, { status: 500 });
    }

    try {
        const body = await request.json();

        // Password authentication
        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = body.passwordHash as string | undefined;
            if (!clientPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        const { model, prompt, seconds, ratio, resolution, generate_audio, input_reference } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Missing required parameter: prompt' }, { status: 400 });
        }

        console.log(
            `Creating video: model=${model}, ratio=${ratio}, resolution=${resolution}, seconds=${seconds}, audio=${generate_audio}`
        );

        // Plain JSON POST — ratio/resolution/generate_audio are BytePlus
        // provider params the TokenHub gateway passes through verbatim;
        // input_reference is a public image URL (image-to-video).
        const video = (await getOpenAI().post('/videos', {
            body: {
                model,
                prompt,
                seconds,
                ratio,
                resolution,
                generate_audio,
                ...(input_reference ? { input_reference } : {})
            }
        })) as {
            id: string;
            status: string;
            progress?: number;
            model: string;
            size?: string;
            seconds?: string;
            created_at: number;
            object: string;
        };

        console.log('Video job created:', video.id, 'status:', video.status);

        return NextResponse.json({
            id: video.id,
            status: video.status,
            progress: video.progress ?? 0,
            model: video.model ?? model,
            size: video.size ?? `${ratio} · ${resolution}`,
            seconds: video.seconds ?? String(seconds),
            created_at: video.created_at,
            object: video.object
        });
    } catch (error: unknown) {
        console.error('Error in /api/videos POST:', error);

        let errorMessage = 'An unexpected error occurred.';
        let status = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
            if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        } else if (typeof error === 'object' && error !== null) {
            if ('message' in error && typeof error.message === 'string') {
                errorMessage = error.message;
            }
            if ('status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        }

        return NextResponse.json({ error: errorMessage }, { status });
    }
}

export async function GET() {
    // The TokenHub gateway does not support listing video jobs (history is
    // kept client-side in IndexedDB) — keep the route honest instead of 500ing.
    return NextResponse.json({ error: 'Video listing is not supported by the gateway.' }, { status: 501 });
}
