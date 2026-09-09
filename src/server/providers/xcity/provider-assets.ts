import { NextResponse } from 'next/server';
import 'server-only';

const RETRYABLE_READ_STATUSES = new Set([502, 503, 504]);
const READ_RETRY_DELAYS_MS = [150, 400] as const;

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

function validationMessage(value: unknown): string {
    if (!Array.isArray(value)) return '';
    return value
        .flatMap((item) => {
            if (!item || typeof item !== 'object') return [];
            const record = item as Record<string, unknown>;
            if (typeof record.msg !== 'string') return [];
            const location = Array.isArray(record.loc)
                ? record.loc
                      .filter((part) => part !== 'body')
                      .map(String)
                      .join('.')
                : '';
            return [location ? `${location}: ${record.msg}` : record.msg];
        })
        .join('; ');
}

function errorMessage(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const record = value as Record<string, unknown>;
    if (typeof record.error === 'string') return record.error;
    if (typeof record.detail === 'string') return record.detail;
    return validationMessage(record.detail);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProviderAsset(
    url: string,
    init: RequestInit,
    retryDelays: readonly number[]
): Promise<{ response: Response; body: unknown }> {
    for (let attempt = 0; ; attempt += 1) {
        try {
            const response = await fetch(url, init);
            const body = (await response.json().catch(() => ({}))) as unknown;
            if (!RETRYABLE_READ_STATUSES.has(response.status) || attempt >= retryDelays.length) {
                return { response, body };
            }
        } catch (error) {
            if (attempt >= retryDelays.length) throw error;
        }
        await sleep(retryDelays[attempt]);
    }
}

export async function providerAssetResponse(
    path: string,
    bearer: string,
    init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}
): Promise<NextResponse> {
    try {
        const requestInit: RequestInit = {
            ...init,
            headers: {
                Authorization: `Bearer ${bearer}`,
                ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                ...init.headers
            },
            cache: 'no-store'
        };
        const method = (requestInit.method ?? 'GET').toUpperCase();
        const { response, body } = await fetchProviderAsset(
            `${gatewayV1BaseUrl()}/provider-assets${path}`,
            requestInit,
            method === 'GET' || method === 'HEAD' ? READ_RETRY_DELAYS_MS : []
        );
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
