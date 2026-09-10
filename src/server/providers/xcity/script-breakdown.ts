import 'server-only';

export type GatewayErrorCode = string | undefined;

export class XcityScriptBreakdownError extends Error {
    constructor(
        message: string,
        public readonly status?: number,
        public readonly requestId?: string,
        public readonly upstreamCode?: GatewayErrorCode
    ) {
        super(message);
        this.name = 'XcityScriptBreakdownError';
    }
}

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

export function scriptBreakdownGatewayUrl(): string {
    return `${gatewayV1BaseUrl()}/drama/script/breakdown`;
}

function errorFields(value: unknown): { code?: string; message?: string } {
    if (!value || typeof value !== 'object') return {};
    const record = value as { detail?: unknown; error?: unknown; message?: unknown };
    const source = record.error && typeof record.error === 'object' ? record.error : record.detail;
    if (source && typeof source === 'object') {
        const error = source as { code?: unknown; message?: unknown };
        return {
            ...(typeof error.code === 'string' ? { code: error.code } : {}),
            ...(typeof error.message === 'string' ? { message: error.message } : {})
        };
    }
    if (typeof source === 'string') return { message: source };
    return typeof record.message === 'string' ? { message: record.message } : {};
}

export async function requestXcityScriptBreakdown(input: {
    bearer: string;
    script: string;
    sourceLanguage: string;
}): Promise<unknown> {
    const response = await fetch(scriptBreakdownGatewayUrl(), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${input.bearer}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ script: input.script, sourceLanguage: input.sourceLanguage })
    });
    const raw = await response.text();
    let payload: unknown = {};
    try {
        payload = raw ? JSON.parse(raw) : {};
    } catch {
        payload = {};
    }
    if (!response.ok) {
        const error = errorFields(payload);
        throw new XcityScriptBreakdownError(
            error.message || 'Script breakdown failed.',
            response.status,
            response.headers.get('x-request-id') ?? undefined,
            error.code
        );
    }
    return payload;
}
