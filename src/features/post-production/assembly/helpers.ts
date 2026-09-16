import type { AssembleClip, AssembleOptions, FFmpegRuntime, TitleOverlayOptions } from './client';

export function createOutputBlob(data: Uint8Array | string) {
    if (typeof data === 'string') throw new Error('FFmpeg returned text output instead of video bytes.');
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    return new Blob([bytes.buffer], { type: 'video/mp4' });
}

export function getReadableError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message || 'Unknown ffmpeg error';
}

export function formatFfmpegNumber(value: number) {
    if (!Number.isFinite(value)) return '0';
    return Number(value.toFixed(3)).toString();
}

export function hasRequestedTrim(clip: AssembleClip) {
    const inTime = clip.inTime ?? 0;
    return (Number.isFinite(inTime) && inTime > 0) || Number.isFinite(clip.outTime);
}

export function hasCaptionSrt(
    opts: AssembleOptions | undefined
): opts is AssembleOptions & { captions: { srt: string } } {
    return Boolean(opts?.captions?.srt.trim());
}

export function normalizeReframeTarget(target: AssembleOptions['reframe']) {
    if (!target) return null;
    const width = Math.round(target.width);
    const height = Math.round(target.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('Invalid export format dimensions.');
    }
    return { width, height };
}

export function getTrimTimes(clip: AssembleClip) {
    const inTime = clip.inTime ?? 0;
    const outTime = clip.outTime;
    if (!Number.isFinite(inTime) || inTime < 0) throw new Error(`Invalid trim start for clip ${clip.id}.`);
    if (typeof outTime !== 'number' || !Number.isFinite(outTime) || outTime <= inTime) {
        throw new Error(`Invalid trim end for clip ${clip.id}.`);
    }
    return { inTime, outTime };
}

function extensionFromMime(mimeType: string) {
    const normalized = mimeType.toLowerCase().split(';')[0].trim();
    const byMime: Record<string, string> = {
        'audio/aac': 'aac',
        'audio/flac': 'flac',
        'audio/m4a': 'm4a',
        'audio/mp3': 'mp3',
        'audio/mp4': 'm4a',
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'audio/webm': 'webm',
        'audio/x-m4a': 'm4a',
        'audio/x-wav': 'wav'
    };
    return byMime[normalized];
}

function extensionFromBlobName(blob: Blob) {
    const name = (blob as Blob & { name?: unknown }).name;
    if (typeof name !== 'string') return undefined;
    const cleanName = name.split(/[?#]/)[0];
    const match = /\.([a-z0-9]{1,8})$/i.exec(cleanName);
    return match?.[1]?.toLowerCase();
}

export function getAudioExtension(blob: Blob) {
    return extensionFromBlobName(blob) ?? extensionFromMime(blob.type) ?? 'mp3';
}

export async function execOrThrow(ffmpeg: FFmpegRuntime, args: string[], label: string) {
    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) throw new Error(`${label} exited with code ${exitCode}.`);
}

export async function deleteIfExists(ffmpeg: FFmpegRuntime, file: string) {
    await ffmpeg.deleteFile(file).catch(() => undefined);
}

export function reframeFilters(target: { width: number; height: number }) {
    const { width, height } = target;
    return [`crop=min(iw\\,ih*${width}/${height}):min(ih\\,iw*${height}/${width})`, `scale=${width}:${height}`];
}

export function subtitlesFilter() {
    return "subtitles=subs.srt:force_style='FontName=Arial,FontSize=18,PrimaryColour=&Hffffff&,OutlineColour=&H80000000&,BorderStyle=1,Outline=1'";
}

function roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

export async function createWatermarkImage(text: string): Promise<Blob> {
    if (typeof document === 'undefined') throw new Error('Branding watermark needs a browser canvas.');
    const scale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const fontSize = 10;
    const paddingX = 6;
    const paddingY = 3;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create watermark canvas.');
    ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
    const metrics = ctx.measureText(text);
    const width = Math.ceil(metrics.width + paddingX * 2);
    const height = Math.ceil(fontSize + paddingY * 2);
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(scale, scale);
    const tokens = getComputedStyle(document.documentElement);
    roundedRect(ctx, 0, 0, width, height, 3);
    ctx.fillStyle = tokens.getPropertyValue('--studio-media-watermark-background').trim();
    ctx.fill();
    ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = tokens.getPropertyValue('--studio-media-watermark-foreground').trim();
    ctx.shadowColor = tokens.getPropertyValue('--studio-media-watermark-shadow').trim();
    ctx.shadowBlur = 1;
    ctx.fillText(text, paddingX, height / 2 + 1);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not render watermark image.');
    return blob;
}

export function durationSeconds(value: string | undefined) {
    if (value === 'first-frame') return 0.12;
    if (value === 'opening-2s') return 2;
    return 1;
}

async function getVideoDimensions(film: Blob): Promise<{ width: number; height: number }> {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return { width: 1280, height: 720 };
    const url = URL.createObjectURL(film);
    try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        const loaded = new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => reject(new Error('Could not inspect video dimensions.'));
        });
        video.src = url;
        await loaded;
        return { width: video.videoWidth || 1280, height: video.videoHeight || 720 };
    } finally {
        URL.revokeObjectURL(url);
    }
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (ctx.measureText(next).width <= maxWidth || !current) {
            current = next;
            continue;
        }
        lines.push(current);
        current = word;
    }
    if (current) lines.push(current);
    return lines.slice(0, 3);
}

export async function createTitleOverlayImage(film: Blob, options: TitleOverlayOptions): Promise<Blob> {
    if (typeof document === 'undefined') throw new Error('Opening title overlay needs a browser canvas.');
    const text = options.text.trim();
    if (!text) throw new Error('Opening title text is empty.');
    const { width, height } = await getVideoDimensions(film);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create title overlay canvas.');
    const minSide = Math.min(width, height);
    const maxWidth = width * 0.78;
    const fontFamily = options.style === 'elegant' ? 'Georgia, Times New Roman, serif' : 'Arial, Helvetica, sans-serif';
    let fontSize = Math.max(30, Math.round(minSide * (options.style === 'bold' ? 0.084 : 0.074)));
    let lines: string[] = [];
    do {
        ctx.font = `${options.style === 'clean' ? 600 : 700} ${fontSize}px ${fontFamily}`;
        lines = wrapCanvasText(ctx, text, maxWidth);
        fontSize -= 2;
    } while (fontSize > 20 && lines.some((line) => ctx.measureText(line).width > maxWidth));
    const lineHeight = Math.round(fontSize * 1.18);
    const blockHeight = lines.length * lineHeight;
    const centerY = Math.round(height * 0.38);
    const startY = centerY - blockHeight / 2;
    const tokens = getComputedStyle(document.documentElement);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = tokens.getPropertyValue('--studio-media-title-shadow').trim();
    ctx.shadowBlur = Math.max(6, Math.round(minSide * 0.012));
    ctx.shadowOffsetY = Math.max(2, Math.round(minSide * 0.004));
    ctx.fillStyle = tokens.getPropertyValue('--studio-media-title-foreground').trim();
    lines.forEach((line, index) => ctx.fillText(line, width / 2, startY + index * lineHeight + lineHeight / 2));
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not render title overlay image.');
    return blob;
}
