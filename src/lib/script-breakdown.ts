import { InvalidApiKeyError } from './errors';
import { createFrontendOpenAI } from './openai-client';

const BREAKDOWN_MODEL = process.env.NEXT_PUBLIC_PROMPT_OPTIMIZER_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `You split scripts into Seedance AI video generator shots.

Rules:
- Split the script into 2-8 video shots.
- Each description must be a concrete visual shot instruction with shot size, subject, action, and setting.
- camera is optional and should be a short camera-move phrase.
- audio is optional and should be a short spoken line or BGM cue.
- Return JSON only in this shape: [{"description":"...","camera":"...","audio":"..."}]
- Omit camera or audio when they are not useful.
- Respond with the JSON array ONLY. No markdown, no commentary.`;

type ScriptShot = {
    description: string;
    camera?: string;
    audio?: string;
};

function extractJsonArray(raw: string): string {
    const withoutFence = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
    const start = withoutFence.indexOf('[');
    const end = withoutFence.lastIndexOf(']');

    if (start === -1 || end === -1 || end <= start) {
        throw new Error('The script breakdown response did not contain a JSON array.');
    }

    return withoutFence.slice(start, end + 1);
}

function normalizeShots(value: unknown): ScriptShot[] {
    if (!Array.isArray(value)) {
        throw new Error('The script breakdown response was not a JSON array.');
    }

    const shots = value.map((item, index) => {
        if (!item || typeof item !== 'object') {
            throw new Error(`Shot ${index + 1} in the script breakdown was not an object.`);
        }

        const record = item as Record<string, unknown>;
        const description = typeof record.description === 'string' ? record.description.trim() : '';
        if (!description) {
            throw new Error(`Shot ${index + 1} in the script breakdown is missing a description.`);
        }

        const camera = typeof record.camera === 'string' ? record.camera.trim() : '';
        const audio = typeof record.audio === 'string' ? record.audio.trim() : '';

        return {
            description,
            ...(camera ? { camera } : {}),
            ...(audio ? { audio } : {})
        };
    });

    if (shots.length === 0) {
        throw new Error('The script breakdown response did not include any shots.');
    }

    return shots;
}

export async function breakdownScript(script: string, apiKey: string, baseURL?: string): Promise<ScriptShot[]> {
    const client = createFrontendOpenAI(apiKey, baseURL);

    try {
        const completion = await client.chat.completions.create({
            model: BREAKDOWN_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: script.trim() }
            ],
            temperature: 0.4,
            max_tokens: 900
        });

        const content = completion.choices[0]?.message?.content?.trim();
        if (!content) {
            throw new Error('The script breakdown returned an empty response.');
        }

        try {
            return normalizeShots(JSON.parse(extractJsonArray(content)));
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Could not parse the script breakdown response: ${error.message}`);
            }
            throw new Error('Could not parse the script breakdown response.');
        }
    } catch (error) {
        if (error && typeof error === 'object') {
            const status = (error as { status?: number }).status;
            if (typeof status === 'number' && (status === 401 || status === 403)) {
                throw new InvalidApiKeyError();
            }
            if (status === 404 || status === 400) {
                throw new Error(
                    `Script breakdown model "${BREAKDOWN_MODEL}" is not available on the gateway. Set NEXT_PUBLIC_PROMPT_OPTIMIZER_MODEL to a model your plan includes.`
                );
            }
        }
        throw error instanceof Error ? error : new Error('Script breakdown failed.');
    }
}
