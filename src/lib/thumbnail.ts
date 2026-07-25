/**
 * Client-side poster capture. The TokenHub gateway serves only the raw MP4
 * (no thumbnail/spritesheet variants like OpenAI's Sora API), so history
 * thumbnails are grabbed from the first frame of the downloaded blob.
 */
export async function captureVideoPoster(videoBlob: Blob): Promise<Blob | undefined> {
    const url = URL.createObjectURL(videoBlob);
    try {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = url;

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('poster capture timeout')), 15000);
            video.onloadeddata = () => {
                clearTimeout(timer);
                resolve();
            };
            video.onerror = () => {
                clearTimeout(timer);
                reject(new Error('failed to load video for poster capture'));
            };
        });

        // Seek slightly in — frame 0 is sometimes black on encoded output.
        if (video.duration && video.duration > 0.2) {
            await new Promise<void>((resolve) => {
                video.onseeked = () => resolve();
                video.currentTime = Math.min(0.1, video.duration / 10);
            });
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        return await new Promise<Blob | undefined>((resolve) =>
            canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/webp', 0.8)
        );
    } catch (err) {
        console.warn('Poster capture failed:', err);
        return undefined;
    } finally {
        URL.revokeObjectURL(url);
    }
}
