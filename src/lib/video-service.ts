import { createFrontendOpenAI } from './openai-client';
import { InvalidApiKeyError } from './errors';
import { clampSeconds } from './seedance';
import type { VideoJob, VideoJobCreate } from '@/types/video';

/**
 * Direct client for the TokenHub gateway's OpenAI-style /v1/videos API.
 * Every call runs in the browser with the user's own key (SSO-fetched or
 * pasted) — there is no server-side proxy or shared key.
 */

/**
 * JSON body for the gateway's POST /v1/videos. `ratio` / `resolution` /
 * `generate_audio` / `camera_fixed` are BytePlus provider params the gateway
 * passes through verbatim; `input_reference` is a public image URL
 * (image-to-video).
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
    if (params.camera_fixed !== undefined) {
        body.camera_fixed = params.camera_fixed;
    }
    return body;
}

export class VideoService {
    private getApiKey: () => string | null;
    private baseURL?: string;

    /**
     * Takes a key *getter*, not a key: SSO keys arrive async and rotate, and
     * closures (submit handlers, polling callbacks) must never act on a key
     * captured by a stale render. The getter reads the always-current ref.
     */
    constructor(config: { getApiKey: () => string | null; baseURL?: string }) {
        this.getApiKey = config.getApiKey;
        this.baseURL = config.baseURL;
    }

    private client() {
        const key = this.getApiKey();
        if (!key) {
            throw new InvalidApiKeyError('No Xcity API key available. Sign in at xcity.ai or set a key.');
        }
        return createFrontendOpenAI(key, this.baseURL);
    }

    private handleError(error: unknown): never {
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
        try {
            // client.post keeps the request plain JSON — the typed
            // videos.create helper switches to multipart when input_reference
            // is present, which the gateway (URL-based image-to-video) does
            // not speak.
            const video = await this.client().post('/videos', { body: buildCreateBody(params) });
            return video as VideoJob;
        } catch (error) {
            this.handleError(error);
        }
    }

    async retrieveVideo(videoId: string): Promise<VideoJob> {
        try {
            // Raw GET, not the typed videos.retrieve helper: the SDK models
            // only OpenAI's documented fields and drops `output_url`, the
            // provider's direct CDN link we play from.
            const video = await this.client().get(`/videos/${encodeURIComponent(videoId)}`);
            return video as VideoJob;
        } catch (error) {
            this.handleError(error);
        }
    }

    async deleteVideo(videoId: string): Promise<void> {
        try {
            await this.client().videos.delete(videoId);
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Downloads the finished MP4. Prefers the provider's direct CDN link when
     * the completed job exposes one — the gateway's /content route proxies the
     * whole file and is unreliable. Falls back to /content otherwise.
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

        try {
            const content = await this.client().videos.downloadContent(videoId, { variant: 'video' });
            return await content.blob();
        } catch (error) {
            this.handleError(error);
        }
    }
}
