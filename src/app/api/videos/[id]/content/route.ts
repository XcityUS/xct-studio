import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';

// Lazy: constructing the client at module scope throws at build time
// (page-data collection) when OPENAI_API_KEY is absent from the build env.
function getOpenAI(): OpenAI {
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_API_BASE_URL
    });
}

const outputDir = path.resolve(process.cwd(), 'generated-videos');

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function ensureOutputDirExists() {
    try {
        await fs.access(outputDir);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            try {
                await fs.mkdir(outputDir, { recursive: true });
                console.log(`Created output directory: ${outputDir}`);
            } catch (mkdirError) {
                console.error(`Error creating output directory ${outputDir}:`, mkdirError);
                throw new Error('Failed to create video output directory.');
            }
        } else {
            console.error(`Error accessing output directory ${outputDir}:`, error);
            throw new Error('Failed to access video output directory.');
        }
    }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const variant = (searchParams.get('variant') as 'video' | 'thumbnail' | 'spritesheet') || 'video';

    console.log(`Received GET request to /api/videos/${id}/content?variant=${variant}`);

    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set.');
        return NextResponse.json({ error: 'Server configuration error: API key not found.' }, { status: 500 });
    }

    try {
        // Determine storage mode
        let effectiveStorageMode: 'fs' | 'indexeddb';
        const explicitMode = process.env.NEXT_PUBLIC_FILE_STORAGE_MODE;
        const isOnVercel = process.env.VERCEL === '1';

        // Prevent fs mode on Vercel (filesystem is read-only/ephemeral)
        if (isOnVercel && explicitMode === 'fs') {
            console.warn('fs mode is not supported on Vercel, forcing indexeddb mode');
            effectiveStorageMode = 'indexeddb';
        } else if (explicitMode === 'fs') {
            effectiveStorageMode = 'fs';
        } else if (explicitMode === 'indexeddb') {
            effectiveStorageMode = 'indexeddb';
        } else if (isOnVercel) {
            effectiveStorageMode = 'indexeddb';
        } else {
            effectiveStorageMode = 'fs';
        }

        // Password authentication - check both header and query param
        const authHeader = request.headers.get('x-password-hash');
        const authQuery = searchParams.get('password-hash');
        const clientPasswordHash = authHeader || authQuery;

        if (process.env.APP_PASSWORD) {
            if (!clientPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        // Determine file extension and content type
        let fileExtension: string;
        let contentType: string;

        if (variant === 'video') {
            fileExtension = 'mp4';
            contentType = 'video/mp4';
        } else if (variant === 'thumbnail') {
            fileExtension = 'webp';
            contentType = 'image/webp';
        } else {
            // spritesheet
            fileExtension = 'jpg';
            contentType = 'image/jpeg';
        }

        let buffer: Buffer;

        // Check if file exists on filesystem first (fs mode only)
        if (effectiveStorageMode === 'fs') {
            await ensureOutputDirExists();
            const filename = `${id}_${variant}.${fileExtension}`;
            const filepath = path.join(outputDir, filename);

            try {
                // Try to read from filesystem first
                buffer = await fs.readFile(filepath);
                console.log(`Serving ${variant} from filesystem: ${filepath}`);
            } catch (error: unknown) {
                // File doesn't exist, download from OpenAI
                if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
                    console.log(`File not found, downloading ${variant} content for video: ${id}`);
                    const content = await getOpenAI().videos.downloadContent(id, { variant });
                    buffer = Buffer.from(await content.arrayBuffer());
                    await fs.writeFile(filepath, buffer);
                    console.log(`Saved ${variant} to: ${filepath}`);
                } else {
                    throw error;
                }
            }
        } else {
            // IndexedDB mode: download from OpenAI (client checks IndexedDB before calling this API)
            console.log(`Downloading ${variant} content for video: ${id}`);
            const content = await getOpenAI().videos.downloadContent(id, { variant });
            buffer = Buffer.from(await content.arrayBuffer());
        }

        // Return the binary content (convert Buffer to Uint8Array for NextResponse)
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${id}_${variant}.${fileExtension}"`,
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (error: unknown) {
        console.error(`Error downloading ${variant} for video ${id}:`, error);

        let errorMessage = 'An unexpected error occurred.';
        let status = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
            if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        }

        return NextResponse.json({ error: errorMessage }, { status });
    }
}
