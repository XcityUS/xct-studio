import { createFrontendOpenAI } from './openai-client';
import { InvalidApiKeyError } from './errors';
import { imageModels as loadRuntimeImageModelIds } from './media-archive';

/**
 * Text-to-image via the TokenHub gateway's OpenAI-style /v1/images API
 * (Seedream models on BytePlus), billed to the same user key as video.
 *
 * The image tab is gated on IMAGE_MODELS from /api/config. That keeps gateway
 * enablement runtime-only, so Railway-style service env changes do not depend
 * on a rebuild.
 */

export interface ImageModel {
    id: string;
    label: string;
}

/** "seedream-4-0-250828" → "Seedream 4 0" is wrong; keep it readable but honest. */
function prettifyModelId(id: string): string {
    const stripped = id.replace(/-\d{6}$/, ''); // drop date suffix
    return stripped
        .split('-')
        .map((part) => (/^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join(' ')
        .replace(/(\d) (\d)/g, '$1.$2'); // "4 0" → "4.0"
}

export async function loadImageModels(): Promise<ImageModel[]> {
    return (await loadRuntimeImageModelIds()).map((id) => ({ id, label: prettifyModelId(id) }));
}

export const IMAGE_SIZES = [
    { id: '1024x1024', label: '1:1 · 1024×1024' },
    { id: '1280x720', label: '16:9 · 1280×720' },
    { id: '720x1280', label: '9:16 · 720×1280' },
    { id: '1152x864', label: '4:3 · 1152×864' },
    { id: '864x1152', label: '3:4 · 864×1152' }
] as const;

export type ImageSizeId = (typeof IMAGE_SIZES)[number]['id'];

export interface GeneratedImage {
    /** Raw bytes when the gateway returned b64 or the URL could be fetched. */
    blob?: Blob;
    /** Provider URL (may expire and may not be CORS-readable). */
    url?: string;
}

export async function generateImages(
    params: { prompt: string; model: string; size: ImageSizeId; n: number },
    apiKey: string,
    baseURL?: string
): Promise<GeneratedImage[]> {
    const client = createFrontendOpenAI(apiKey, baseURL);
    const requestedCount = Math.max(1, Math.min(4, Math.trunc(params.n)));

    async function requestImages(n: number): Promise<GeneratedImage[]> {
        const response = await client.images.generate({
            model: params.model,
            prompt: params.prompt,
            n,
            size: params.size as never // gateway passes provider sizes through; the SDK's union is OpenAI-only
        });

        const results: GeneratedImage[] = [];
        for (const item of response.data ?? []) {
            if (item.b64_json) {
                const bytes = Uint8Array.from(atob(item.b64_json), (c) => c.charCodeAt(0));
                results.push({ blob: new Blob([bytes], { type: 'image/png' }) });
            } else if (item.url) {
                // Try to pull the bytes so the image survives the provider link
                // expiring; keep the URL as a fallback when CORS blocks us.
                try {
                    const res = await fetch(item.url);
                    if (res.ok) {
                        results.push({ blob: await res.blob(), url: item.url });
                        continue;
                    }
                } catch {
                    // CORS or network — fall through to URL-only.
                }
                results.push({ url: item.url });
            }
        }
        return results;
    }

    try {
        const results = await requestImages(requestedCount);
        while (results.length < requestedCount) {
            const [image] = await requestImages(1);
            if (!image) break;
            results.push(image);
        }
        if (results.length === 0) {
            throw new Error('The gateway returned no images.');
        }
        return results.slice(0, requestedCount);
    } catch (error) {
        if (error && typeof error === 'object') {
            const status = (error as { status?: number }).status;
            if (typeof status === 'number' && (status === 401 || status === 403)) {
                throw new InvalidApiKeyError();
            }
            if (status === 404) {
                throw new Error(
                    `Image model "${params.model}" is not available on the gateway. Check IMAGE_MODELS.`
                );
            }
        }
        throw error instanceof Error ? error : new Error('Image generation failed.');
    }
}
