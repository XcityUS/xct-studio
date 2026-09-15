import { scriptBreakdownGatewayUrl } from '@/server/providers/xcity/script-breakdown';
import { createScriptBreakdown, ScriptBreakdownError } from '@/server/script/breakdown';

const MAX_SCRIPT_CHARACTERS = 120_000;
const UPSTREAM_HEADERS = {
    'X-Xcity-Upstream': scriptBreakdownGatewayUrl(),
    'X-Xcity-Upstream-Provider': 'litellm'
};
type BreakdownBody = { script?: unknown; sourceLanguage?: unknown };

function bearerFrom(request: Request): string {
    const authorization = request.headers.get('authorization')?.trim() ?? '';
    return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
}

function serverBearer(): string {
    return (process.env.XCITY_LITELLM_API_KEY || process.env.TOKENHUB_API_KEY || '').trim();
}

async function readRequestBody(request: Request): Promise<BreakdownBody | null> {
    return (await request.json().catch(() => null)) as BreakdownBody | null;
}

function validationResponse(message: string) {
    return Response.json(
        { error: { code: 'VALIDATION_FAILED', message } },
        { status: 400, headers: UPSTREAM_HEADERS }
    );
}

function scriptFrom(body: BreakdownBody): string | Response {
    const script = typeof body.script === 'string' ? body.script.trim() : '';
    if (!script) return validationResponse('Enter a script first.');
    if (script.length > MAX_SCRIPT_CHARACTERS) {
        return validationResponse('The script is too long to break down in one request.');
    }
    return script;
}

async function breakdownResponse(input: {
    script: string;
    sourceLanguage: string;
    requestBearer: string;
    fallbackBearer: string;
}): Promise<Response> {
    const primaryBearer = input.requestBearer || input.fallbackBearer;
    try {
        return Response.json(await createScriptBreakdown(input.script, primaryBearer, input.sourceLanguage), {
            headers: UPSTREAM_HEADERS
        });
    } catch (error) {
        if (
            error instanceof ScriptBreakdownError &&
            error.code === 'UNAUTHORIZED' &&
            input.requestBearer &&
            input.fallbackBearer &&
            input.requestBearer !== input.fallbackBearer
        ) {
            return Response.json(await createScriptBreakdown(input.script, input.fallbackBearer, input.sourceLanguage), {
                headers: UPSTREAM_HEADERS
            });
        }
        throw error;
    }
}

export async function POST(request: Request) {
    const requestBearer = bearerFrom(request);
    const fallbackBearer = serverBearer();
    if (!requestBearer && !fallbackBearer) {
        return Response.json(
            { error: { code: 'UNAUTHORIZED', message: 'Configure XCITY_LITELLM_API_KEY on the server or sign in with a user key.' } },
            { status: 401, headers: UPSTREAM_HEADERS }
        );
    }

    try {
        const body = await readRequestBody(request);
        if (!body) return validationResponse('Request body must be valid JSON.');
        const script = scriptFrom(body);
        if (script instanceof Response) return script;

        const sourceLanguage = typeof body.sourceLanguage === 'string' ? body.sourceLanguage : 'zh-CN';
        return await breakdownResponse({ script, sourceLanguage, requestBearer, fallbackBearer });
    } catch (error) {
        if (error instanceof ScriptBreakdownError) {
            return Response.json(
                { error: { code: error.code, message: error.message } },
                { status: error.status, headers: UPSTREAM_HEADERS }
            );
        }
        return Response.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Script breakdown failed.' } },
            { status: 500, headers: UPSTREAM_HEADERS }
        );
    }
}
