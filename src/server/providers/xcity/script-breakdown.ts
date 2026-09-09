import 'server-only';

export type GatewayErrorCode = string | undefined;

export class XcityChatError extends Error {
    constructor(
        message: string,
        public readonly status?: number,
        public readonly requestId?: string,
        public readonly upstreamCode?: GatewayErrorCode
    ) {
        super(message);
        this.name = 'XcityChatError';
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
    return `${gatewayV1BaseUrl()}/chat/completions`;
}

type XcityScriptBreakdownInput = {
    bearer: string;
    model: string;
    script: string;
    systemPrompt: string;
};

type GatewayMessage = {
    role?: string;
    content?: string | null;
};

type GatewayChoice = {
    message?: GatewayMessage;
};

type GatewayChatResponse = {
    choices?: GatewayChoice[];
    error?: {
        code?: GatewayErrorCode;
        message?: string;
        type?: string;
    };
};

function parseErrorMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
        return 'Xcity chat request failed.';
    }

    const record = payload as {
        error?: { message?: string; code?: GatewayErrorCode; type?: string };
        message?: string;
    };

    if (typeof record.error?.message === 'string' && record.error.message.trim()) {
        const extra = [record.error.code, record.error.type].filter(Boolean).join(' / ');
        return extra ? `${record.error.message} (${extra})` : record.error.message;
    }

    if (typeof record.message === 'string' && record.message.trim()) {
        return record.message;
    }

    return 'Xcity chat request failed.';
}

async function postChatCompletions(
    input: XcityScriptBreakdownInput,
    wantJsonObject = true
): Promise<GatewayChatResponse> {
    const response = await fetch(scriptBreakdownGatewayUrl(), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${input.bearer}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: input.model,
            messages: [
                { role: 'system', content: input.systemPrompt },
                { role: 'user', content: input.script }
            ],
            temperature: 0.3,
            max_tokens: 4000,
            ...(wantJsonObject ? { response_format: { type: 'json_object' } } : {})
        })
    });

    const rawText = await response.text();
    let payload: unknown = {};
    try {
        payload = rawText ? JSON.parse(rawText) : {};
    } catch {
        payload = {};
    }

    const requestId = response.headers.get('x-request-id') ?? undefined;
    if (!response.ok) {
        const message = parseErrorMessage(payload);
        const code =
            payload && typeof payload === 'object'
                ? (payload as { error?: { code?: GatewayErrorCode } }).error?.code
                : undefined;
        throw new XcityChatError(message, response.status, requestId, code);
    }

    return payload as GatewayChatResponse;
}

export async function requestXcityScriptBreakdown(input: XcityScriptBreakdownInput): Promise<string> {
    let response: GatewayChatResponse;

    try {
        response = await postChatCompletions(input, true);
    } catch (error) {
        if (
            error instanceof XcityChatError &&
            error.status === 400 &&
            /response_format|json_object|response format/i.test(error.message)
        ) {
            response = await postChatCompletions(input, false);
        } else {
            throw error;
        }
    }

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
        throw new XcityChatError('The script breakdown returned an empty response.', 502, undefined, undefined);
    }
    return content;
}
