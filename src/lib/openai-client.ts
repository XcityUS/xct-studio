import OpenAI from 'openai';
import { InvalidApiKeyError } from './errors';

export class RateLimitError extends Error {
    retryAt?: string;

    constructor(message = 'The gateway rate limit has been reached.', retryAt?: string) {
        super(message);
        this.name = 'RateLimitError';
        this.retryAt = retryAt;
    }
}

export class BudgetExceededError extends Error {
    constructor(message = 'The API key budget has been exceeded.') {
        super(message);
        this.name = 'BudgetExceededError';
    }
}

export function createFrontendOpenAI(apiKey: string, baseURL?: string): OpenAI {
    return new OpenAI({
        apiKey,
        baseURL,
        dangerouslyAllowBrowser: true
    });
}

export async function verifyFrontendApiKey(apiKey: string, baseURL?: string): Promise<void> {
    const client = createFrontendOpenAI(apiKey, baseURL);

    try {
        await client.models.list();
    } catch (error) {
        if (error instanceof OpenAI.AuthenticationError) {
            throw new InvalidApiKeyError();
        }

        if (error && typeof error === 'object') {
            const status = (error as { status?: number }).status;
            if (typeof status === 'number' && (status === 401 || status === 403)) {
                throw new InvalidApiKeyError();
            }
            if (status === 429) {
                const headers = (error as { headers?: Headers | Record<string, string> }).headers;
                const retryAt =
                    headers instanceof Headers
                        ? (headers.get('x-ratelimit-reset-requests') ?? headers.get('retry-after') ?? undefined)
                        : headers?.['x-ratelimit-reset-requests'] ?? headers?.['retry-after'];
                throw new RateLimitError('The gateway is rate-limiting this API key right now.', retryAt);
            }

            const code = (error as { code?: string; error?: { code?: string } }).code ??
                (error as { code?: string; error?: { code?: string } }).error?.code;
            if (code === 'invalid_api_key') {
                throw new InvalidApiKeyError();
            }
        }

        throw error instanceof Error ? error : new Error('Failed to verify API key');
    }
}
