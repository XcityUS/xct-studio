import {
    createOutputBlob, createTitleOverlayImage, createWatermarkImage, deleteIfExists, durationSeconds,
    execOrThrow, formatFfmpegNumber, getAudioExtension, getReadableError, getTrimTimes, hasCaptionSrt,
    hasRequestedTrim, normalizeReframeTarget, reframeFilters, subtitlesFilter
} from './helpers';

const CORE_PATH = '/ffmpeg/ffmpeg-core.esm.js';
const WASM_PATH = '/ffmpeg/ffmpeg-core.wasm';
const CLASS_WORKER_PATH = '/ffmpeg/ffmpeg-worker.js';
const LIST_FILE = 'list.txt';
const JOINED_FILE = 'joined.mp4';
const OUTPUT_FILE = 'out.mp4';
const CAPTION_INPUT_FILE = 'caption_input.mp4';
const CAPTION_SRT_FILE = 'subs.srt';
const CAPTION_IMAGE_PREFIX = 'caption_overlay_';
const WATERMARK_INPUT_FILE = 'watermark_input.mp4';
const WATERMARK_IMAGE_FILE = 'watermark.png';
const WATERMARK_OUTPUT_FILE = 'watermark_output.mp4';
const TITLE_INPUT_FILE = 'title_input.mp4';
const TITLE_IMAGE_FILE = 'title_overlay.png';
const TITLE_OUTPUT_FILE = 'title_output.mp4';
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

export type TitleOverlayOptions = {
    text: string;
    style?: string;
    duration?: string;
};

export class CaptionBurnUnavailableError extends Error {
    constructor(message = 'Caption burn-in is unavailable in this browser FFmpeg runtime.') {
        super(message);
        this.name = 'CaptionBurnUnavailableError';
    }
}

export type FFmpegRuntime = {
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
    let captionImageFiles: string[] = [];

    const reportProgress = (ratio: number) => {
        if (!onProgress) return;
        const next = clampProgress(ratio);
        if (next < lastProgress) return;
        lastProgress = next;
        onProgress(next);
    };

    try {
        reportProgress(0);
        const [{ fetchFile }, { createCaptionImages }, loadedFFmpeg] = await Promise.all([
            import('@ffmpeg/util'),
            import('../captions/images'),
            getFFmpeg()
        ]);
        ffmpeg = loadedFFmpeg;

        if (onProgress) {
            progressHandler = ({ progress }) => {
                reportProgress(progress);
            };
            ffmpeg.on('progress', progressHandler);
        }

        await ffmpeg.writeFile(CAPTION_INPUT_FILE, await fetchFile(film));
        const captionImages = await createCaptionImages(film, captions.srt);
        captionImageFiles = captionImages.map((_, index) => `${CAPTION_IMAGE_PREFIX}${index}.png`);
        for (const [index, caption] of captionImages.entries()) {
            await ffmpeg.writeFile(captionImageFiles[index], await fetchFile(caption.blob));
        }
        reportProgress(0.05);
        const filters = captionImages.map((caption, index) => {
            const input = index === 0 ? '[0:v]' : `[caption${index - 1}]`;
            const output = index === captionImages.length - 1 ? '[captioned]' : `[caption${index}]`;
            return `${input}[${index + 1}:v]overlay=0:0:enable='between(t,${formatFfmpegNumber(caption.start)},${formatFfmpegNumber(caption.end)})':format=auto${output}`;
        });
        await deleteIfExists(ffmpeg, FINAL_OUTPUT_FILE);
        await execOrThrow(
            ffmpeg,
            [
                '-i',
                CAPTION_INPUT_FILE,
                ...captionImageFiles.flatMap((file) => ['-i', file]),
                '-filter_complex',
                filters.join(';'),
                '-map',
                '[captioned]',
                '-map',
                '0:a?',
                '-c:v',
                'libx264',
                '-preset',
                'veryfast',
                '-crf',
                '20',
                '-c:a',
                'copy',
                '-movflags',
                '+faststart',
                FINAL_OUTPUT_FILE
            ],
            'FFmpeg caption burn-in'
        );
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
                [CAPTION_INPUT_FILE, FINAL_OUTPUT_FILE, ...captionImageFiles].map((file) =>
                    loadedFFmpeg.deleteFile(file)
                )
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

export async function burnTitleOverlayIntoVideo(
    film: Blob,
    options: TitleOverlayOptions,
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

    const visibleSeconds = durationSeconds(options.duration);
    const titleArgs = [
        '-i',
        TITLE_INPUT_FILE,
        '-i',
        TITLE_IMAGE_FILE,
        '-filter_complex',
        `[0:v][1:v]overlay=0:0:enable='between(t,0,${formatFfmpegNumber(visibleSeconds)})':format=auto`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '21',
        '-c:a',
        'copy',
        '-movflags',
        '+faststart',
        TITLE_OUTPUT_FILE
    ];

    try {
        reportProgress(0);
        const [{ fetchFile }, loadedFFmpeg] = await Promise.all([import('@ffmpeg/util'), getFFmpeg()]);
        ffmpeg = loadedFFmpeg;

        if (onProgress) {
            progressHandler = ({ progress }) => reportProgress(progress);
            ffmpeg.on('progress', progressHandler);
        }

        await ffmpeg.writeFile(TITLE_INPUT_FILE, await fetchFile(film));
        await ffmpeg.writeFile(TITLE_IMAGE_FILE, await fetchFile(await createTitleOverlayImage(film, options)));
        reportProgress(0.05);

        await execOrThrow(ffmpeg, titleArgs, 'FFmpeg opening title overlay');

        const output = await ffmpeg.readFile(TITLE_OUTPUT_FILE);
        reportProgress(1);
        return createOutputBlob(output);
    } catch (error) {
        throw new Error(`Could not add opening title: ${getReadableError(error)}`);
    } finally {
        if (ffmpeg && progressHandler) {
            ffmpeg.off?.('progress', progressHandler);
        }

        if (ffmpeg) {
            const loadedFFmpeg = ffmpeg;
            await Promise.allSettled(
                [TITLE_INPUT_FILE, TITLE_IMAGE_FILE, TITLE_OUTPUT_FILE].map((file) => loadedFFmpeg.deleteFile(file))
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
