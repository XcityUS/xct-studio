import { normalizeScriptAnalysis } from '@/features/script/schema';
import type { ScriptAnalysisDraft } from '@/features/script/types';
import { requestXcityScriptBreakdown, XcityScriptBreakdownError } from '@/server/providers/xcity/script-breakdown';
import 'server-only';

export class ScriptBreakdownError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code: string
    ) {
        super(message);
        this.name = 'ScriptBreakdownError';
    }
}

export async function createScriptBreakdown(
    script: string,
    bearer: string,
    sourceLanguage: string
): Promise<ScriptAnalysisDraft> {
    try {
        return normalizeScriptAnalysis(await requestXcityScriptBreakdown({ bearer, script, sourceLanguage }));
    } catch (error) {
        if (error instanceof XcityScriptBreakdownError) {
            const code =
                error.upstreamCode ??
                (error.status === 401 || error.status === 403 ? 'UNAUTHORIZED' : 'PROVIDER_UNAVAILABLE');
            throw new ScriptBreakdownError(error.message, error.status ?? 502, code);
        }
        throw new ScriptBreakdownError(
            error instanceof Error ? error.message : 'Script breakdown returned invalid data.',
            502,
            'INVALID_RESPONSE'
        );
    }
}
