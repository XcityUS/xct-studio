import { createFrontendOpenAI } from './openai-client';
import { InvalidApiKeyError } from './errors';

/**
 * AI prompt refinement via the TokenHub gateway's chat API, billed to the
 * same user key as video generation.
 *
 * The model id is deployment-configurable: the gateway must expose it in its
 * model list. Defaults to a small, cheap chat model.
 */
const OPTIMIZER_MODEL = process.env.NEXT_PUBLIC_PROMPT_OPTIMIZER_MODEL || 'gpt-4o-mini';

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

    try {
        const completion = await client.chat.completions.create({
            model: OPTIMIZER_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: rawPrompt.trim() }
            ],
            temperature: 0.7,
            max_tokens: 300
        });

        const optimized = completion.choices[0]?.message?.content?.trim();
        if (!optimized) {
            throw new Error('The optimizer returned an empty response.');
        }
        return optimized;
    } catch (error) {
        if (error && typeof error === 'object') {
            const status = (error as { status?: number }).status;
            if (typeof status === 'number' && (status === 401 || status === 403)) {
                throw new InvalidApiKeyError();
            }
            if (status === 404 || status === 400) {
                throw new Error(
                    `Prompt optimizer model "${OPTIMIZER_MODEL}" is not available on the gateway. Set NEXT_PUBLIC_PROMPT_OPTIMIZER_MODEL to a model your plan includes.`
                );
            }
        }
        throw error instanceof Error ? error : new Error('Prompt optimization failed.');
    }
}
