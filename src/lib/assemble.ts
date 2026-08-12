const CORE_URL = '/ffmpeg/ffmpeg-core.js';
const WASM_URL = '/ffmpeg/ffmpeg-core.wasm';
const LIST_FILE = 'list.txt';
const JOINED_FILE = 'joined.mp4';
const OUTPUT_FILE = 'out.mp4';

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
};

type FFmpegProgressEvent = {
    progress: number;
    time?: number;
};

type ProgressCallback = (ratio: number) => void;

type FFmpegRuntime = {
    load: (config: { coreURL: string; wasmURL: string }) => Promise<boolean>;
    writeFile: (path: string, data: Uint8Array | string) => Promise<unknown>;
    readFile: (path: string) => Promise<Uint8Array | string>;
    deleteFile: (path: string) => Promise<unknown>;
    exec: (args: string[]) => Promise<number>;
    on: (event: 'progress', callback: (event: FFmpegProgressEvent) => void) => void;
    off?: (event: 'progress', callback: (event: FFmpegProgressEvent) => void) => void;
};

let ffmpegPromise: Promise<FFmpegRuntime> | null = null;

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
                coreURL: CORE_URL,
                wasmURL: WASM_URL
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
    const inputFiles = clips.map((_, index) => `${index}.mp4`);
    const trimmedFiles = clips.map((_, index) => `trimmed_${index}.mp4`);
    const bgmFile = opts?.bgm ? `bgm.${getAudioExtension(opts.bgm.blob)}` : null;
    const filesToDelete = [
        ...inputFiles,
        ...trimmedFiles,
        LIST_FILE,
        JOINED_FILE,
        OUTPUT_FILE,
        ...(bgmFile ? [bgmFile] : [])
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

        const outputFile = opts?.bgm && bgmFile ? OUTPUT_FILE : JOINED_FILE;
        if (opts?.bgm && bgmFile) {
            await ffmpeg.writeFile(bgmFile, await fetchFile(opts.bgm.blob));

            const volume = formatFfmpegNumber(Math.max(0, opts.bgm.volume));
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

            setProgressStage(0.6, 0.4);
            try {
                await execOrThrow(ffmpeg, primaryArgs, 'FFmpeg BGM mix');
            } catch (error) {
                console.warn('BGM mix with source audio failed; retrying without source audio.', error);
                await deleteIfExists(ffmpeg, OUTPUT_FILE);
                await execOrThrow(ffmpeg, fallbackArgs, 'FFmpeg BGM mix fallback');
            }
            reportProgress(1);
        }

        const output = await ffmpeg.readFile(outputFile);
        reportProgress(1);
        return createOutputBlob(output);
    } catch (error) {
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
