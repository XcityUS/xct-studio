import { normalizeShotDrafts } from '@/features/script/schema';
import type { ShotDraft } from '@/features/script/types';
import { requestXcityScriptBreakdown } from '@/server/providers/xcity/script-breakdown';
import 'server-only';

const SYSTEM_PROMPT = `You split Chinese or English short-drama scripts into video shots.

Rules:
- Preserve the story order, character identity, dialogue meaning, and scene continuity.
- Split the supplied text into 2-12 practical video shots.
- Each description must be a concrete visual instruction with shot size, subject, action, and setting.
- Assign durationSeconds to each shot based on narrative rhythm. Use 2-4 seconds for quick action or reaction, 4-8 seconds for dialogue/emotion, and 8-12 seconds only for important beats.
- camera is optional and must be a short camera-move phrase.
- audio is optional and must be a short spoken line, sound effect, or BGM cue.
- Return JSON only: {"shots":[{"description":"...","camera":"...","audio":"...","durationSeconds":4}]}.
- Omit camera or audio when not useful. Do not add markdown or commentary.`;

const FALLBACK_BREAKDOWN_MODELS = ['deepseek-v4-pro-260425', 'seed-1-8-251228', 'seed-1-6-flash-250715', 'gpt-5-mini'];

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

class ScriptBreakdownParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ScriptBreakdownParseError';
    }
}

function configuredModels(value?: string): string[] {
    return (value ?? '')
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean);
}

function breakdownModels(): string[] {
    return Array.from(
        new Set([
            ...configuredModels(process.env.SCRIPT_BREAKDOWN_MODEL),
            ...configuredModels(process.env.PROMPT_OPTIMIZER_MODEL),
            ...configuredModels(process.env.NEXT_PUBLIC_PROMPT_OPTIMIZER_MODEL),
            ...FALLBACK_BREAKDOWN_MODELS
        ])
    );
}

function extractJson(raw: string): unknown {
    const text = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
    const objectStart = text.indexOf('{');
    const objectEnd = text.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) return JSON.parse(text.slice(objectStart, objectEnd + 1));

    const arrayStart = text.indexOf('[');
    const arrayEnd = text.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) return JSON.parse(text.slice(arrayStart, arrayEnd + 1));
    throw new Error('The model response did not contain JSON.');
}

function parseShotDrafts(raw: string): ShotDraft[] {
    try {
        return normalizeShotDrafts(extractJson(raw));
    } catch (error) {
        throw new ScriptBreakdownParseError(
            error instanceof Error ? error.message : 'The model response was not valid JSON.'
        );
    }
}

export async function createScriptBreakdown(script: string, bearer: string): Promise<ShotDraft[]> {
    const models = breakdownModels();
    const errors: { model: string; error: unknown; status?: number }[] = [];

    for (const model of models) {
        try {
            const content = await requestXcityScriptBreakdown({
                bearer,
                model,
                script,
                systemPrompt: SYSTEM_PROMPT
            });
            return parseShotDrafts(content);
        } catch (error) {
            const status = error && typeof error === 'object' ? (error as { status?: number }).status : undefined;
            errors.push({ model, error, status });

            if (error instanceof ScriptBreakdownParseError) {
                continue;
            }

            if (![400, 401, 403, 404, 429].includes(status ?? 0)) {
                break;
            }
        }
    }

    const authError = errors.find((item) => item.status === 401 || item.status === 403);
    const rateLimitError = errors.find((item) => item.status === 429);
    const unavailableErrors = errors.filter((item) => item.status === 400 || item.status === 404);
    const parseErrors = errors.filter((item) => item.error instanceof ScriptBreakdownParseError);
    const lastError = errors.at(-1)?.error;

    if (authError && errors.every((item) => item.status === 401 || item.status === 403)) {
        throw new ScriptBreakdownError(
            `Your Xcity API key cannot access script breakdown models (${models.join(', ')}).`,
            401,
            'UNAUTHORIZED'
        );
    }
    if (rateLimitError && errors.every((item) => item.status === 429)) {
        throw new ScriptBreakdownError('Script breakdown is rate-limited. Please try again shortly.', 429, 'RATE_LIMITED');
    }
    if (unavailableErrors.length === errors.length) {
        throw new ScriptBreakdownError(
            `Script breakdown models are unavailable on this gateway (${models.join(', ')}).`,
            503,
            'MODEL_UNAVAILABLE'
        );
    }
    if (parseErrors.length === errors.length) {
        throw new ScriptBreakdownError(
            `Script breakdown models returned invalid JSON (${models.join(', ')}).`,
            502,
            'PROVIDER_UNAVAILABLE'
        );
    }
    throw new ScriptBreakdownError(
        lastError instanceof Error ? lastError.message : 'Script breakdown failed.',
        502,
        'PROVIDER_UNAVAILABLE'
    );
}
