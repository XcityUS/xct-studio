import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isAllowedProviderUrl(value: string): URL | null {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return null;
    }
    if (url.protocol !== 'https:') return null;
    if (!url.hostname.endsWith('.volces.com')) return null;
    return url;
}

function providerVideoHeaders(): HeadersInit {
    return {
        Accept: 'video/mp4,video/*;q=0.9,*/*;q=0.8',
        Range: 'bytes=0-'
    };
}

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof body?.url === 'string' ? isAllowedProviderUrl(body.url) : null;
    if (!url) {
        return NextResponse.json({ error: 'Unsupported video source URL.' }, { status: 400 });
    }

    const upstream = await fetch(url, { cache: 'no-store', headers: providerVideoHeaders() });
    if (!upstream.ok || !upstream.body) {
        return NextResponse.json({ error: `Provider download failed (${upstream.status}).` }, { status: upstream.status });
    }

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'video/mp4');
    const length = upstream.headers.get('Content-Length');
    if (length) headers.set('Content-Length', length);
    return new Response(upstream.body, { status: 200, headers });
}
