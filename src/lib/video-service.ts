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
        seconds: clampSeconds(params.seconds, params.model),
        resolution: params.resolution,
        generate_audio: params.generate_audio
    };
    if (params.reference_image_urls && params.reference_image_urls.length > 0) {
        // Multi-reference mode: the gateway turns the array into content items
        // with role "reference_image". Ratio stays valid here — only the
        // first-frame mode derives it from the image.
        body.input_reference = params.reference_image_urls;
        body.ratio = params.ratio;
    } else if (params.input_reference_url) {
        // BytePlus rejects `ratio` on first-frame (image-to-video) tasks with
        // InvalidParameter.TaskTypeConstraint — the output ratio always
        // follows the reference image, so the param must be omitted entirely.
        body.input_reference = params.input_reference_url;
    } else {
        body.ratio = params.ratio;
    }
    if (params.camera_fixed !== undefined) {
        body.camera_fixed = params.camera_fixed;
    }
    return body;
}

/**
 * The gateway's status strings vary by provider path: LiteLLM's OpenAI-style
 * videos API says "processing", OpenAI says "in_progress", and BytePlus/Ark
 * tasks report "running"/"succeeded". Collapse them onto the four statuses
 * the app models — an unrecognized value counts as still-running so polling
 * continues rather than dropping the job.
 */
const STATUS_MAP: Record<string, VideoJob['status']> = {
    queued: 'queued',
    pending: 'queued',
    submitted: 'queued',
    in_progress: 'in_progress',
    processing: 'in_progress',
    running: 'in_progress',
    completed: 'completed',
    succeeded: 'completed',
    success: 'completed',
    failed: 'failed',
    error: 'failed',
    cancelled: 'failed',
    canceled: 'failed',
    expired: 'failed'
};

function normalizeJob(raw: unknown): VideoJob {
    const job = raw as VideoJob & { status?: string; progress?: number | string };
    const status = STATUS_MAP[String(job.status ?? '').toLowerCase()] ?? 'in_progress';
    const reported = Number(job.progress);
    const progress =
        status === 'completed' ? 100 : Number.isFinite(reported) ? Math.max(0, Math.min(100, reported)) : 0;
    return { ...job, status, progress };
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

    private handleError(error: unknown, model?: string): never {
        if (error && typeof error === 'object') {
            const status = (error as { status?: number }).status;
            const code = (error as { code?: string }).code;
            const err = error as { message?: string; type?: string; error?: { message?: string; type?: string } };
            const gatewayMessage = err.error?.message ?? err.message;
            const errorType = err.error?.type ?? err.type;

            if (typeof status === 'number' && (status === 401 || status === 403)) {
                // LiteLLM answers "this key may not use that model" with a 401
                // too — that is a model-allowlist problem on the gateway, not a
                // bad key, and must not wipe the stored key.
                const modelAccessDenied =
                    errorType === 'key_model_access_denied' ||
                    errorType === 'team_model_access_denied' ||
                    (typeof gatewayMessage === 'string' &&
                        /model/i.test(gatewayMessage) &&
                        /access|allow/i.test(gatewayMessage));
                if (modelAccessDenied) {
                    throw new Error(
                        `Your key does not have access to model "${model ?? 'unknown'}"` +
                            (gatewayMessage ? ` — ${gatewayMessage}` : '') +
                            ". Add it to the key's allowed models on TokenHub."
                    );
                }
                throw new InvalidApiKeyError(gatewayMessage);
            }
            if (code === 'invalid_api_key') {
                throw new InvalidApiKeyError(gatewayMessage);
            }
            // 404 = model unknown to the gateway; 400 only counts when the
            // body specifically blames the model name (a plain 400 is usually
            // a provider param rejection — e.g. "parameter ratio is not
            // valid", which also contains the words model/invalid — and must
            // surface untouched below).
            const modelNotFound =
                status === 404 ||
                (status === 400 &&
                    typeof gatewayMessage === 'string' &&
                    /invalid model|unknown model|model .{0,40}(not found|does not exist)|not in (the )?model list/i.test(
                        gatewayMessage
                    ));
            if (modelNotFound && model) {
                throw new Error(
                    `Video model "${model}" is not available on the gateway` +
                        (gatewayMessage ? `: ${gatewayMessage}` : '.')
                );
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
            return normalizeJob(video);
        } catch (error) {
            this.handleError(error, params.model);
        }
    }

    async retrieveVideo(videoId: string): Promise<VideoJob> {
        try {
            // Raw GET, not the typed videos.retrieve helper: the SDK models
            // only OpenAI's documented fields and drops `output_url`, the
            // provider's direct CDN link we play from.
            const video = await this.client().get(`/videos/${encodeURIComponent(videoId)}`);
            return normalizeJob(video);
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
