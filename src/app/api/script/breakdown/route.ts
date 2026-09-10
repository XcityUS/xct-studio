import { scriptBreakdownGatewayUrl } from '@/server/providers/xcity/script-breakdown';
import { createScriptBreakdown, ScriptBreakdownError } from '@/server/script/breakdown';

const MAX_SCRIPT_CHARACTERS = 120_000;
const UPSTREAM_HEADERS = {
    'X-Xcity-Upstream': scriptBreakdownGatewayUrl(),
    'X-Xcity-Upstream-Provider': 'litellm'
};

function bearerFrom(request: Request): string {
    const authorization = request.headers.get('authorization')?.trim() ?? '';
    return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
}

export async function POST(request: Request) {
    const bearer = bearerFrom(request);
    if (!bearer) {
        return Response.json(
            { error: { code: 'UNAUTHORIZED', message: 'Sign in or configure an Xcity API key.' } },
            { status: 401, headers: UPSTREAM_HEADERS }
        );
    }

    try {
        const body = (await request.json().catch(() => null)) as { script?: unknown; sourceLanguage?: unknown } | null;
        if (!body) {
            return Response.json(
                { error: { code: 'VALIDATION_FAILED', message: 'Request body must be valid JSON.' } },
                { status: 400, headers: UPSTREAM_HEADERS }
            );
        }
        const script = typeof body.script === 'string' ? body.script.trim() : '';
        if (!script || script.length > MAX_SCRIPT_CHARACTERS) {
            return Response.json(
                {
                    error: {
                        code: 'VALIDATION_FAILED',
                        message: script
                            ? 'The script is too long to break down in one request.'
                            : 'Enter a script first.'
                    }
                },
                { status: 400, headers: UPSTREAM_HEADERS }
            );
        }

        const sourceLanguage = typeof body.sourceLanguage === 'string' ? body.sourceLanguage : 'zh-CN';
        return Response.json(await createScriptBreakdown(script, bearer, sourceLanguage), {
            headers: UPSTREAM_HEADERS
        });
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
