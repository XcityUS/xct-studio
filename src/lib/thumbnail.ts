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

async function captureFrameAt(
    videoBlob: Blob,
    resolveTime: (duration: number) => number
): Promise<Blob | undefined> {
    const url = URL.createObjectURL(videoBlob);
    try {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = url;

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
        URL.revokeObjectURL(url);
    }
}

export async function captureVideoFrame(videoBlob: Blob, atTime: number): Promise<Blob | undefined> {
    return captureFrameAt(videoBlob, () => atTime);
}

export async function captureVideoPoster(videoBlob: Blob): Promise<Blob | undefined> {
    // Seek slightly in — frame 0 is sometimes black on encoded output.
    return captureVideoFrame(videoBlob, 0.1);
}

export async function captureVideoLastFrame(videoBlob: Blob): Promise<Blob | undefined> {
    return captureFrameAt(videoBlob, (duration) => duration - 0.05);
}
