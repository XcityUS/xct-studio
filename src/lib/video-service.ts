import { createFrontendOpenAI } from './openai-client';
import { InvalidApiKeyError } from './errors';
import { clampSeconds } from './seedance';
import type { VideoJob, VideoJobCreate } from '@/types/video';

export type ApiMode = 'backend' | 'frontend';

interface ServiceConfig {
    mode: ApiMode;
    clientApiKey?: string | null;
    clientPasswordHash?: string | null;
    baseURL?: string;
}

/**
 * JSON body for the gateway's POST /v1/videos. `ratio` / `resolution` /
 * `generate_audio` are BytePlus provider params the gateway passes through
 * verbatim; `input_reference` is a public image URL (image-to-video).
 */
function buildCreateBody(params: VideoJobCreate): Record<string, unknown> {
    const body: Record<string, unknown> = {
        model: params.model,
        prompt: params.prompt,
        seconds: clampSeconds(params.seconds),
        ratio: params.ratio,
        resolution: params.resolution,
        generate_audio: params.generate_audio
    };
    if (params.input_reference_url) {
        body.input_reference = params.input_reference_url;
    }
    return body;
}

export class VideoService {
    private config: ServiceConfig;

    constructor(config: ServiceConfig) {
        this.config = config;
    }

    private handleFrontendError(error: unknown): never {
        if (error && typeof error === 'object') {
            const status = (error as { status?: number }).status;
            const code = (error as { code?: string }).code;
            if ((typeof status === 'number' && (status === 401 || status === 403)) || code === 'invalid_api_key') {
                throw new InvalidApiKeyError();
            }
        }

        if (error instanceof Error) {
            throw error;
        }

        throw new Error('Unexpected error while communicating with the video gateway.');
    }

    async createVideo(params: VideoJobCreate): Promise<VideoJob> {
        if (this.config.mode === 'frontend') {
            if (!this.config.clientApiKey) {
                throw new Error('API key is required for frontend mode');
            }

            const openai = createFrontendOpenAI(this.config.clientApiKey, this.config.baseURL);

            try {
                // client.post keeps the request plain JSON — the typed
                // videos.create helper switches to multipart when
                // input_reference is present, which the gateway (URL-based
                // image-to-video) does not speak.
                const video = await openai.post('/videos', { body: buildCreateBody(params) });
                return video as VideoJob;
            } catch (error) {
                this.handleFrontendError(error);
            }
        } else {
            const response = await fetch('/api/videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...buildCreateBody(params),
                    passwordHash: this.config.clientPasswordHash ?? undefined
                })
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || `API request failed with status ${response.status}`);
            }

            return await response.json();
        }
    }

    async retrieveVideo(videoId: string): Promise<VideoJob> {
        if (this.config.mode === 'frontend') {
            if (!this.config.clientApiKey) {
                throw new Error('API key is required for frontend mode');
            }

            const openai = createFrontendOpenAI(this.config.clientApiKey, this.config.baseURL);
            try {
                const video = await openai.videos.retrieve(videoId);
                return video as unknown as VideoJob;
            } catch (error) {
                this.handleFrontendError(error);
            }
        } else {
            const response = await fetch(`/api/videos/${videoId}`, {
                headers: this.config.clientPasswordHash ? { 'x-password-hash': this.config.clientPasswordHash } : {}
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch job status: ${response.statusText}`);
            }

            return await response.json();
        }
    }

    async deleteVideo(videoId: string): Promise<void> {
        if (this.config.mode === 'frontend') {
            if (!this.config.clientApiKey) {
                throw new Error('API key is required for frontend mode');
            }

            const openai = createFrontendOpenAI(this.config.clientApiKey, this.config.baseURL);
            try {
                await openai.videos.delete(videoId);
            } catch (error) {
                this.handleFrontendError(error);
            }
        } else {
            const response = await fetch(`/api/videos/${videoId}`, {
                method: 'DELETE',
                headers: this.config.clientPasswordHash ? { 'x-password-hash': this.config.clientPasswordHash } : {}
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to delete video');
            }
        }
    }

    /**
     * Downloads the finished MP4. Prefers the provider's direct CDN link when
     * the completed job exposes one — the gateway's /content route proxies the
     * whole file and is unreliable. Falls back to /content otherwise. Only the
     * `video` variant exists (no thumbnails/spritesheets — previews are
     * generated client-side from the blob).
     */
    async downloadContent(videoId: string, outputUrl?: string): Promise<Blob> {
        if (outputUrl) {
            // Plain cross-origin GET: no auth header, so the CDN's CORS policy
            // is the only gate. If it blocks us the video still plays via the
            // <video> element (media loads are not CORS-gated) — the caller
            // treats this archive step as best-effort.
            const direct = await fetch(outputUrl);
            if (direct.ok) {
                return await direct.blob();
            }
            console.warn(`Direct CDN download failed (${direct.status}), falling back to gateway`);
        }

        if (this.config.mode === 'frontend') {
            if (!this.config.clientApiKey) {
                throw new Error('API key is required for frontend mode');
            }

            const openai = createFrontendOpenAI(this.config.clientApiKey, this.config.baseURL);
            try {
                const content = await openai.videos.downloadContent(videoId, { variant: 'video' });
                return await content.blob();
            } catch (error) {
                this.handleFrontendError(error);
            }
        } else {
            const url = `/api/videos/${videoId}/content?variant=video`;
            const fullUrl = this.config.clientPasswordHash
                ? `${url}&password-hash=${encodeURIComponent(this.config.clientPasswordHash)}`
                : url;

            const response = await fetch(fullUrl, {
                headers: this.config.clientPasswordHash ? { 'x-password-hash': this.config.clientPasswordHash } : {}
            });

            if (!response.ok) {
                throw new Error(`Failed to download video: ${response.statusText}`);
            }

            return await response.blob();
        }
    }
}
