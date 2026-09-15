import { burnCaptionsIntoVideo } from '@/features/post-production/assembly/client';

export async function createCaptionedVideo(
    videoSrc: string,
    subtitleSrt: string,
    onProgress?: (progress: number) => void
) {
    const response = await fetch(videoSrc);
    if (!response.ok) {
        throw new Error(`Could not load the current video (${response.status}).`);
    }

    return burnCaptionsIntoVideo(await response.blob(), { srt: subtitleSrt }, onProgress);
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    try {
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
    } finally {
        document.body.removeChild(anchor);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

export function captionedFilename(filename: string | undefined, jobId: string) {
    const baseName = filename?.replace(/\.[^.]+$/, '') || jobId;
    return `${baseName}-subtitled.mp4`;
}
