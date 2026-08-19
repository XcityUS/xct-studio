/**
 * Client-side frame capture. The TokenHub gateway serves only the raw MP4
 * (no thumbnail/spritesheet variants like OpenAI's Sora API), so history
 * thumbnails and extend frames are grabbed from the downloaded blob.
 */

function waitForVideoEvent(
    video: HTMLVideoElement,
    eventName: keyof HTMLMediaElementEventMap,
    message: string
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`${message} timeout`));
        }, 15000);

        const cleanup = () => {
            clearTimeout(timer);
            video.removeEventListener(eventName, handleEvent);
            video.removeEventListener('error', handleError);
        };
        const handleEvent = () => {
            cleanup();
            resolve();
        };
        const handleError = () => {
            cleanup();
            reject(new Error(`failed to load video for ${message}`));
        };

        video.addEventListener(eventName, handleEvent, { once: true });
        video.addEventListener('error', handleError, { once: true });
    });
}

async function drawCurrentFrame(video: HTMLVideoElement): Promise<Blob | undefined> {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob | undefined>((resolve) =>
        canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/webp', 0.8)
    );
}

type FrameSource = { kind: 'blob'; blob: Blob } | { kind: 'url'; url: string };

async function captureFrameFrom(
    source: FrameSource,
    resolveTime: (duration: number) => number
): Promise<Blob | undefined> {
    const objectUrl = source.kind === 'blob' ? URL.createObjectURL(source.blob) : null;
    try {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        if (source.kind === 'url') {
            // Let the browser Range-request only the bytes the seek needs —
            // downloading a whole 4K clip to grab one frame costs tens of MB.
            // crossOrigin keeps the canvas untainted (our media host is
            // CORS-open, which is exactly why R2 copies are capturable).
            video.crossOrigin = 'anonymous';
            video.preload = 'metadata';
            video.src = source.url;
        } else {
            video.preload = 'auto';
            video.src = objectUrl as string;
        }

        if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
            await waitForVideoEvent(video, 'loadedmetadata', 'frame capture');
        }

        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const latestSafeTime = duration > 0.05 ? duration - 0.05 : 0;
        const atTime = resolveTime(duration);
        const requestedTime = Number.isFinite(atTime) ? atTime : latestSafeTime;
        const targetTime = duration
            ? Math.min(Math.max(requestedTime, 0), latestSafeTime)
            : Math.max(requestedTime, 0);

        if (targetTime > 0) {
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                    cleanup();
                    reject(new Error('frame seek timeout'));
                }, 15000);
                const cleanup = () => {
                    clearTimeout(timer);
                    video.removeEventListener('seeked', handleSeeked);
                    video.removeEventListener('error', handleError);
                };
                const handleSeeked = () => {
                    cleanup();
                    resolve();
                };
                const handleError = () => {
                    cleanup();
                    reject(new Error('failed to seek video for frame capture'));
                };

                video.addEventListener('seeked', handleSeeked, { once: true });
                video.addEventListener('error', handleError, { once: true });
                video.currentTime = targetTime;
            });
        } else if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            await waitForVideoEvent(video, 'loadeddata', 'frame capture');
        }

        return await drawCurrentFrame(video);
    } catch (err) {
        console.warn('Frame capture failed:', err);
        return undefined;
    } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
}

function captureFrameAt(videoBlob: Blob, resolveTime: (duration: number) => number): Promise<Blob | undefined> {
    return captureFrameFrom({ kind: 'blob', blob: videoBlob }, resolveTime);
}

export async function captureVideoFrame(videoBlob: Blob, atTime: number): Promise<Blob | undefined> {
    return captureFrameAt(videoBlob, () => atTime);
}

export async function captureVideoPoster(videoBlob: Blob): Promise<Blob | undefined> {
    // Seek slightly in — frame 0 is sometimes black on encoded output.
    return captureVideoFrame(videoBlob, 0.1);
}

/** Poster from a CORS-open URL (R2), streamed rather than fully downloaded. */
export async function captureVideoPosterFromUrl(url: string): Promise<Blob | undefined> {
    return captureFrameFrom({ kind: 'url', url }, () => 0.1);
}

export async function captureVideoLastFrame(videoBlob: Blob): Promise<Blob | undefined> {
    return captureFrameAt(videoBlob, (duration) => duration - 0.05);
}

export async function getVideoDuration(videoBlob: Blob): Promise<number> {
    const url = URL.createObjectURL(videoBlob);
    try {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.src = url;

        if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
            await waitForVideoEvent(video, 'loadedmetadata', 'duration read');
        }

        return Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
    } finally {
        URL.revokeObjectURL(url);
    }
}
