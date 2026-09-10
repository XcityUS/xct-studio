import { normalizeScriptAnalysis } from '@/features/script/schema';
import type { ScriptAnalysisDraft } from '@/features/script/types';
import { InvalidApiKeyError } from '@/shared/errors';

type BreakdownResponse = Partial<ScriptAnalysisDraft> & {
    error?: {
        message?: string;
    };
};

export async function breakdownScript(
    script: string,
    apiKey: string,
    sourceLanguage: string
): Promise<ScriptAnalysisDraft> {
    const response = await fetch('/api/script/breakdown', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ script, sourceLanguage })
    });
    const body = (await response.json().catch(() => ({}))) as BreakdownResponse;

    if (response.status === 401 || response.status === 403) {
        throw new InvalidApiKeyError('Your Xcity API key is invalid or expired. Configure a new key and retry.');
    }
    if (!response.ok) {
        throw new Error(body.error?.message || 'Script breakdown failed.');
    }
    return normalizeScriptAnalysis(body);
}
