import { createFrontendOpenAI } from './openai-client';
import { InvalidApiKeyError } from './errors';

/**
 * AI prompt refinement via the TokenHub gateway's chat API, billed to the
 * same user key as video generation.
 *
 * Models are attempted in order. Keep the list within the current Xcity
 * whitelist so video users can optimize prompts with the same TokenHub key.
 */
const OPTIMIZER_MODELS = ['deepseek-v4-pro-260425', 'seed-1-8-251228', 'seed-1-6-flash-250715'];

const SYSTEM_PROMPT = `You are a prompt engineer for the Seedance text-to-video model. Rewrite the user's idea into one production-ready video prompt.

Rules:
- Structure: shot type, subject, action, setting, lighting, camera movement.
- Keep the user's core idea, subject and any style they named; enrich, don't replace.
- Concrete and visual — no abstractions, no marketing language.
- One paragraph, under 120 words.
- Respond in the same language the user wrote in.
- Output ONLY the rewritten prompt. No quotes, no explanations, no options.`;

export async function optimizePrompt(rawPrompt: string, apiKey: string, baseURL?: string): Promise<string> {
    const client = createFrontendOpenAI(apiKey, baseURL);
    const errors: unknown[] = [];

    for (const model of OPTIMIZER_MODELS) {
        try {
            const completion = await client.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: rawPrompt.trim() }
                ],
                temperature: 0.7,
                max_tokens: 300
            });

            const optimized = completion.choices[0]?.message?.content?.trim();
            if (!optimized) {
                throw new Error(`The optimizer model "${model}" returned an empty response.`);
            }
            return optimized;
        } catch (error) {
            errors.push(error);
        }
    }

    throw optimizerError(errors, OPTIMIZER_MODELS.join(', '));
}

function getErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
}

function optimizerError(errors: unknown[], models: string): Error {
    const authError = errors.find((error) => getErrorStatus(error) === 401);
    if (authError) {
        return new InvalidApiKeyError();
    }

    const lastError = errors.at(-1);
    const status = getErrorStatus(lastError);
    if (typeof status === 'number') {
        if (status === 403) {
            return new Error(
                `Prompt optimizer failed after trying all fallback models. Your Xcity API key is not allowed to access these models (${models}).`
            );
        }
        if (status === 404 || status === 400) {
            return new Error(`Prompt optimizer failed after trying all fallback models (${models}).`);
        }
    }

    return lastError instanceof Error
        ? new Error(`Prompt optimizer failed after trying all fallback models (${models}): ${lastError.message}`)
        : new Error(`Prompt optimizer failed after trying all fallback models (${models}).`);
}
