import { InvalidApiKeyError } from './errors';
import { createFrontendOpenAI } from './openai-client';

export type TtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

function ttsModelUnavailableError(model: string) {
    return new Error(
        `TTS model "${model}" is not available on the gateway. Set TTS_MODEL to a model your plan includes.`
    );
}

function getStatus(error: unknown) {
    if (!error || typeof error !== 'object') return undefined;
    return (error as { status?: unknown }).status;
}

export async function synthesizeSpeech(
    text: string,
    apiKey: string,
    model: string,
    baseURL?: string,
    voice?: string
): Promise<Blob> {
    const input = text.trim();
    if (!input) {
        throw new Error('Enter voiceover text before generating speech.');
    }

    const client = createFrontendOpenAI(apiKey, baseURL);

    try {
        const response = await client.audio.speech.create({
            model,
            voice: voice || 'alloy',
            input,
            response_format: 'mp3'
        });
        const blob = await response.blob();
        return blob.type === 'audio/mpeg' ? blob : new Blob([blob], { type: 'audio/mpeg' });
    } catch (error) {
        const status = getStatus(error);
        if (typeof status === 'number' && (status === 401 || status === 403)) {
            throw new InvalidApiKeyError();
        }
        if (status === 400 || status === 404) {
            throw ttsModelUnavailableError(model);
        }
        throw error instanceof Error ? error : new Error('Speech generation failed.');
    }
}
