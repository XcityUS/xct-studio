const CORE_PATH = '/ffmpeg/ffmpeg-core.esm.js';
const WASM_PATH = '/ffmpeg/ffmpeg-core.wasm';
const CLASS_WORKER_PATH = '/ffmpeg/ffmpeg-worker.js';
const LIST_FILE = 'list.txt';
const JOINED_FILE = 'joined.mp4';
const OUTPUT_FILE = 'out.mp4';
const CAPTION_INPUT_FILE = 'caption_input.mp4';
const CAPTION_SRT_FILE = 'subs.srt';
const WATERMARK_INPUT_FILE = 'watermark_input.mp4';
const WATERMARK_IMAGE_FILE = 'watermark.png';
const WATERMARK_OUTPUT_FILE = 'watermark_output.mp4';
const FINAL_OUTPUT_FILE = 'final.mp4';

export type AssembleClip = {
    id: string;
    blob: Blob;
    inTime?: number;
    outTime?: number;
};

export type AssembleOptions = {
    bgm?: {
        blob: Blob;
        volume: number;
    };
    captions?: {
        srt: string;
    };
    reframe?: {
        width: number;
        height: number;
    };
};

type FFmpegProgressEvent = {
    progress: number;
    time?: number;
};

type ProgressCallback = (ratio: number) => void;

export class CaptionBurnUnavailableError extends Error {
    constructor(message = 'Caption burn-in is unavailable in this browser FFmpeg runtime.') {
        super(message);
        this.name = 'CaptionBurnUnavailableError';
    }
}

type FFmpegRuntime = {
    load: (config: { classWorkerURL: string; coreURL: string; wasmURL: string }) => Promise<boolean>;
    writeFile: (path: string, data: Uint8Array | string) => Promise<unknown>;
    readFile: (path: string) => Promise<Uint8Array | string>;
    deleteFile: (path: string) => Promise<unknown>;
    exec: (args: string[]) => Promise<number>;
    on: (event: 'progress', callback: (event: FFmpegProgressEvent) => void) => void;
    off?: (event: 'progress', callback: (event: FFmpegProgressEvent) => void) => void;
};

let ffmpegPromise: Promise<FFmpegRuntime> | null = null;

function publicUrl(path: string) {
    if (typeof window === 'undefined') return path;
    return new URL(path, window.location.origin).toString();
}

function clampProgress(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

async function getFFmpeg() {
    if (!ffmpegPromise) {
        ffmpegPromise = (async () => {
            const { FFmpeg } = await import('@ffmpeg/ffmpeg');
            const ffmpeg = new FFmpeg() as FFmpegRuntime;
            await ffmpeg.load({
                classWorkerURL: publicUrl(CLASS_WORKER_PATH),
                coreURL: publicUrl(CORE_PATH),
                wasmURL: publicUrl(WASM_PATH)
            });
            return ffmpeg;
        })().catch((error) => {
            ffmpegPromise = null;
            throw error;
        });
    }

    return ffmpegPromise;
}

function createOutputBlob(data: Uint8Array | string) {
    if (typeof data === 'string') {
        throw new Error('FFmpeg returned text output instead of video bytes.');
    }

    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    return new Blob([bytes.buffer], { type: 'video/mp4' });
}

function getReadableError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message || 'Unknown ffmpeg error';
}

function formatFfmpegNumber(value: number) {
    if (!Number.isFinite(value)) return '0';
    return Number(value.toFixed(3)).toString();
}

function hasRequestedTrim(clip: AssembleClip) {
    const inTime = clip.inTime ?? 0;
    return (Number.isFinite(inTime) && inTime > 0) || Number.isFinite(clip.outTime);
}

function hasCaptionSrt(opts: AssembleOptions | undefined): opts is AssembleOptions & { captions: { srt: string } } {
    return Boolean(opts?.captions?.srt.trim());
}

function normalizeReframeTarget(target: AssembleOptions['reframe']) {
    if (!target) return null;

    const width = Math.round(target.width);
    const height = Math.round(target.height);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('Invalid export format dimensions.');
    }

    return { width, height };
}

function getTrimTimes(clip: AssembleClip) {
    const inTime = clip.inTime ?? 0;
    const outTime = clip.outTime;

    if (!Number.isFinite(inTime) || inTime < 0) {
        throw new Error(`Invalid trim start for clip ${clip.id}.`);
    }

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

function getAudioExtension(blob: Blob) {
    return extensionFromBlobName(blob) ?? extensionFromMime(blob.type) ?? 'mp3';
}

async function execOrThrow(ffmpeg: FFmpegRuntime, args: string[], label: string) {
    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) {
        throw new Error(`${label} exited with code ${exitCode}.`);
    }
}

async function deleteIfExists(ffmpeg: FFmpegRuntime, file: string) {
    await ffmpeg.deleteFile(file).catch(() => undefined);
}

function reframeFilters(target: { width: number; height: number }) {
    const { width, height } = target;
    return [`crop=min(iw\\,ih*${width}/${height}):min(ih\\,iw*${height}/${width})`, `scale=${width}:${height}`];
}

function subtitlesFilter() {
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

async function createWatermarkImage(text: string): Promise<Blob> {
    if (typeof document === 'undefined') {
        throw new Error('Branding watermark needs a browser canvas.');
    }

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

    roundedRect(ctx, 0, 0, width, height, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
    ctx.fill();

    ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 1;
    ctx.fillText(text, paddingX, height / 2 + 1);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not render watermark image.');
    return blob;
}

async function reencodeVideoFile(
    ffmpeg: FFmpegRuntime,
    inputFile: string,
    outputFile: string,
    opts: {
        captions?: { srt: string };
        reframe?: { width: number; height: number };
    }
) {
    const filters = [
        ...(opts.reframe ? reframeFilters(opts.reframe) : []),
        ...(opts.captions ? [subtitlesFilter()] : [])
    ];

    if (opts.captions) {
        await ffmpeg.writeFile(CAPTION_SRT_FILE, new TextEncoder().encode(opts.captions.srt));
    }
    await deleteIfExists(ffmpeg, outputFile);

    try {
        await execOrThrow(
            ffmpeg,
            [
                '-i',
                inputFile,
                '-vf',
                filters.join(','),
                '-c:v',
                'libx264',
                '-preset',
                'veryfast',
                '-crf',
                '20',
                '-c:a',
                'copy',
                outputFile
            ],
            opts.captions ? 'FFmpeg caption burn-in' : 'FFmpeg reframe'
        );
    } catch (error) {
        if (opts.captions) {
            throw new CaptionBurnUnavailableError(getReadableError(error));
        }
        throw error;
    }
}

export async function burnCaptionsIntoVideo(
    film: Blob,
    captions: { srt: string },
    onProgress?: ProgressCallback
): Promise<Blob> {
    let ffmpeg: FFmpegRuntime | null = null;
    let progressHandler: ((event: FFmpegProgressEvent) => void) | null = null;
    let lastProgress = 0;

    const reportProgress = (ratio: number) => {
        if (!onProgress) return;
        const next = clampProgress(ratio);
        if (next < lastProgress) return;
        lastProgress = next;
        onProgress(next);
    };

    try {
        reportProgress(0);
        const [{ fetchFile }, loadedFFmpeg] = await Promise.all([import('@ffmpeg/util'), getFFmpeg()]);
        ffmpeg = loadedFFmpeg;

        if (onProgress) {
            progressHandler = ({ progress }) => {
                reportProgress(progress);
            };
            ffmpeg.on('progress', progressHandler);
        }

        await ffmpeg.writeFile(CAPTION_INPUT_FILE, await fetchFile(film));
        reportProgress(0.05);
        await reencodeVideoFile(ffmpeg, CAPTION_INPUT_FILE, FINAL_OUTPUT_FILE, { captions });
        const output = await ffmpeg.readFile(FINAL_OUTPUT_FILE);
        reportProgress(1);
        return createOutputBlob(output);
    } catch (error) {
        if (error instanceof CaptionBurnUnavailableError) {
            throw error;
        }
        throw new CaptionBurnUnavailableError(getReadableError(error));
    } finally {
        if (ffmpeg && progressHandler) {
            ffmpeg.off?.('progress', progressHandler);
        }

        if (ffmpeg) {
            const loadedFFmpeg = ffmpeg;
            await Promise.allSettled(
                [CAPTION_INPUT_FILE, CAPTION_SRT_FILE, FINAL_OUTPUT_FILE].map((file) => loadedFFmpeg.deleteFile(file))
            );
        }
    }
}

export async function burnBrandingWatermarkIntoVideo(
    film: Blob,
    text = 'generated by xcity ai studio',
    onProgress?: ProgressCallback
): Promise<Blob> {
    let ffmpeg: FFmpegRuntime | null = null;
    let progressHandler: ((event: FFmpegProgressEvent) => void) | null = null;
    let lastProgress = 0;

    const reportProgress = (ratio: number) => {
        if (!onProgress) return;
        const next = clampProgress(ratio);
        if (next < lastProgress) return;
        lastProgress = next;
        onProgress(next);
    };

    const watermarkArgs = [
        '-i',
        WATERMARK_INPUT_FILE,
        '-i',
        WATERMARK_IMAGE_FILE,
        '-filter_complex',
        '[1:v]format=rgba[wm];[0:v][wm]overlay=W-w-24:H-h-24:format=auto',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'copy',
        '-movflags',
        '+faststart',
        WATERMARK_OUTPUT_FILE
    ];

    try {
        reportProgress(0);
        const [{ fetchFile }, loadedFFmpeg] = await Promise.all([import('@ffmpeg/util'), getFFmpeg()]);
        ffmpeg = loadedFFmpeg;

        if (onProgress) {
            progressHandler = ({ progress }) => reportProgress(progress);
            ffmpeg.on('progress', progressHandler);
        }

        await ffmpeg.writeFile(WATERMARK_INPUT_FILE, await fetchFile(film));
        await ffmpeg.writeFile(WATERMARK_IMAGE_FILE, await fetchFile(await createWatermarkImage(text)));
        reportProgress(0.05);

        await execOrThrow(ffmpeg, watermarkArgs, 'FFmpeg branding watermark');

        const output = await ffmpeg.readFile(WATERMARK_OUTPUT_FILE);
        reportProgress(1);
        return createOutputBlob(output);
    } catch (error) {
        throw new Error(`Could not add branding watermark: ${getReadableError(error)}`);
    } finally {
        if (ffmpeg && progressHandler) {
            ffmpeg.off?.('progress', progressHandler);
        }

        if (ffmpeg) {
            const loadedFFmpeg = ffmpeg;
            await Promise.allSettled(
                [WATERMARK_INPUT_FILE, WATERMARK_IMAGE_FILE, WATERMARK_OUTPUT_FILE].map((file) =>
                    loadedFFmpeg.deleteFile(file)
                )
            );
        }
    }
}

export async function assembleClips(clips: AssembleClip[], onProgress?: ProgressCallback): Promise<Blob>;
export async function assembleClips(
    clips: AssembleClip[],
    opts?: AssembleOptions,
    onProgress?: ProgressCallback
): Promise<Blob>;
export async function assembleClips(
    clips: AssembleClip[],
    optsOrProgress?: AssembleOptions | ProgressCallback,
    maybeProgress?: ProgressCallback
): Promise<Blob> {
    if (clips.length < 2) {
        throw new Error('Select at least two completed clips to assemble.');
    }

    const opts = typeof optsOrProgress === 'function' ? undefined : optsOrProgress;
    const onProgress = typeof optsOrProgress === 'function' ? optsOrProgress : maybeProgress;
    const shouldBurnCaptions = hasCaptionSrt(opts);
    const reframeTarget = normalizeReframeTarget(opts?.reframe);
    const needsFinalReencode = shouldBurnCaptions || Boolean(reframeTarget);
    const inputFiles = clips.map((_, index) => `${index}.mp4`);
    const trimmedFiles = clips.map((_, index) => `trimmed_${index}.mp4`);
    const bgmFile = opts?.bgm ? `bgm.${getAudioExtension(opts.bgm.blob)}` : null;
    const filesToDelete = [
        ...inputFiles,
        ...trimmedFiles,
        LIST_FILE,
        JOINED_FILE,
        OUTPUT_FILE,
        ...(bgmFile ? [bgmFile] : []),
        ...(needsFinalReencode ? [FINAL_OUTPUT_FILE] : []),
        ...(shouldBurnCaptions ? [CAPTION_SRT_FILE] : [])
    ];
    let ffmpeg: FFmpegRuntime | null = null;
    let progressHandler: ((event: FFmpegProgressEvent) => void) | null = null;
    let stageStart = 0;
    let stageSpan = 0;
    let lastProgress = 0;

    const reportProgress = (ratio: number) => {
        if (!onProgress) return;
        const next = clampProgress(ratio);
        if (next < lastProgress) return;
        lastProgress = next;
        onProgress(next);
    };

    const setProgressStage = (start: number, span: number) => {
        stageStart = start;
        stageSpan = span;
        reportProgress(start);
    };

    try {
        reportProgress(0);
        const [{ fetchFile }, loadedFFmpeg] = await Promise.all([import('@ffmpeg/util'), getFFmpeg()]);
        ffmpeg = loadedFFmpeg;

        if (onProgress) {
            progressHandler = ({ progress }) => {
                reportProgress(stageStart + progress * stageSpan);
            };
            ffmpeg.on('progress', progressHandler);
        }

        const concatFiles: string[] = [];
        const trimSpan = 0.4 / clips.length;
        for (let index = 0; index < clips.length; index += 1) {
            await ffmpeg.writeFile(inputFiles[index], await fetchFile(clips[index].blob));

            const trimStart = index * trimSpan;
            if (!hasRequestedTrim(clips[index])) {
                concatFiles.push(inputFiles[index]);
                reportProgress(trimStart + trimSpan);
                continue;
            }

            const { inTime, outTime } = getTrimTimes(clips[index]);
            const trimmedFile = trimmedFiles[index];
            setProgressStage(trimStart, trimSpan);
            await execOrThrow(
                ffmpeg,
                [
                    '-ss',
                    formatFfmpegNumber(inTime),
                    '-to',
                    formatFfmpegNumber(outTime),
                    '-i',
                    inputFiles[index],
                    '-c:v',
                    'libx264',
                    '-preset',
                    'veryfast',
                    '-crf',
                    '20',
                    '-c:a',
                    'aac',
                    '-movflags',
                    '+faststart',
                    trimmedFile
                ],
                'FFmpeg trim'
            );
            concatFiles.push(trimmedFile);
            reportProgress(trimStart + trimSpan);
        }

        await ffmpeg.writeFile(
            LIST_FILE,
            new TextEncoder().encode(concatFiles.map((file) => `file '${file}'`).join('\n'))
        );

        setProgressStage(0.4, 0.2);
        await execOrThrow(
            ffmpeg,
            ['-f', 'concat', '-safe', '0', '-i', LIST_FILE, '-c', 'copy', JOINED_FILE],
            'FFmpeg concat'
        );
        reportProgress(0.6);

        let outputFile = opts?.bgm && bgmFile ? OUTPUT_FILE : JOINED_FILE;
        if (opts?.bgm && bgmFile) {
            await ffmpeg.writeFile(bgmFile, await fetchFile(opts.bgm.blob));

            const volume = formatFfmpegNumber(Math.max(0, opts.bgm.volume));
            const bgmStageSpan = needsFinalReencode ? 0.2 : 0.4;
            const primaryArgs = [
                '-i',
                JOINED_FILE,
                '-i',
                bgmFile,
                '-filter_complex',
                `[1:a]volume=${volume}[bg];[0:a][bg]amix=duration=first:dropout_transition=2[a]`,
                '-map',
                '0:v',
                '-map',
                '[a]',
                '-c:v',
                'copy',
                '-c:a',
                'aac',
                '-shortest',
                OUTPUT_FILE
            ];
            const fallbackArgs = [
                '-i',
                JOINED_FILE,
                '-i',
                bgmFile,
                '-filter_complex',
                `[1:a]volume=${volume}[a]`,
                '-map',
                '0:v',
                '-map',
                '[a]',
                '-c:v',
                'copy',
                '-c:a',
                'aac',
                '-shortest',
                OUTPUT_FILE
            ];

            setProgressStage(0.6, bgmStageSpan);
            try {
                await execOrThrow(ffmpeg, primaryArgs, 'FFmpeg BGM mix');
            } catch (error) {
                console.warn('BGM mix with source audio failed; retrying without source audio.', error);
                await deleteIfExists(ffmpeg, OUTPUT_FILE);
                await execOrThrow(ffmpeg, fallbackArgs, 'FFmpeg BGM mix fallback');
            }
            reportProgress(needsFinalReencode ? 0.8 : 1);
        }

        if (needsFinalReencode) {
            setProgressStage(opts?.bgm ? 0.8 : 0.6, opts?.bgm ? 0.2 : 0.4);
            await reencodeVideoFile(ffmpeg, outputFile, FINAL_OUTPUT_FILE, {
                ...(shouldBurnCaptions ? { captions: opts.captions } : {}),
                ...(reframeTarget ? { reframe: reframeTarget } : {})
            });
            outputFile = FINAL_OUTPUT_FILE;
            reportProgress(1);
        }

        const output = await ffmpeg.readFile(outputFile);
        reportProgress(1);
        return createOutputBlob(output);
    } catch (error) {
        if (error instanceof CaptionBurnUnavailableError) {
            throw error;
        }
        throw new Error(`Could not assemble clips: ${getReadableError(error)}`);
    } finally {
        if (ffmpeg && progressHandler) {
            ffmpeg.off?.('progress', progressHandler);
        }

        if (ffmpeg) {
            const loadedFFmpeg = ffmpeg;
            await Promise.allSettled(filesToDelete.map((file) => loadedFFmpeg.deleteFile(file)));
        }
    }
}
