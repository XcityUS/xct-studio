import type { ShotDraft } from '@/features/script/types';
import { InvalidApiKeyError } from '@/shared/errors';

type BreakdownResponse = {
    shots?: ShotDraft[];
    error?: {
        message?: string;
    };
};

export async function breakdownScript(script: string, apiKey: string): Promise<ShotDraft[]> {
    const response = await fetch('/api/script/breakdown', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ script })
    });
    const body = (await response.json().catch(() => ({}))) as BreakdownResponse;

    if (response.status === 401 || response.status === 403) {
        throw new InvalidApiKeyError('Your Xcity API key is invalid or expired. Configure a new key and retry.');
    }
    if (!response.ok) {
        throw new Error(body.error?.message || 'Script breakdown failed.');
    }
    if (!body.shots?.length) {
        throw new Error('Script breakdown did not return any shots.');
    }
    return body.shots;
}
