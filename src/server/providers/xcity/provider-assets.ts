import { NextResponse } from 'next/server';
import 'server-only';

function gatewayV1BaseUrl(): string {
    const configured = (
        process.env.XCITY_LITELLM_URL ||
        process.env.TOKENHUB_URL ||
        process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL ||
        'https://tokenhub.xcity.one'
    )
        .trim()
        .replace(/\/+$/, '');
    return configured.endsWith('/v1') ? configured : `${configured}/v1`;
}

function errorMessage(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const record = value as Record<string, unknown>;
    if (typeof record.error === 'string') return record.error;
    if (typeof record.detail === 'string') return record.detail;
    return '';
}

export async function providerAssetResponse(
    path: string,
    bearer: string,
    init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}
): Promise<NextResponse> {
    try {
        const response = await fetch(`${gatewayV1BaseUrl()}/provider-assets${path}`, {
            ...init,
            headers: {
                Authorization: `Bearer ${bearer}`,
                ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                ...init.headers
            },
            cache: 'no-store'
        });
        const body = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) {
            return NextResponse.json(
                { error: errorMessage(body) || `Provider asset request failed (${response.status}).` },
                { status: response.status }
            );
        }
        return NextResponse.json(body, { status: response.status });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Provider asset gateway is unavailable.' },
            { status: 502 }
        );
    }
}
