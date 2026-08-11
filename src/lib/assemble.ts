const CORE_URL = '/ffmpeg/ffmpeg-core.js';
const WASM_URL = '/ffmpeg/ffmpeg-core.wasm';
const LIST_FILE = 'list.txt';
const OUTPUT_FILE = 'out.mp4';

type AssembleClip = {
    id: string;
    blob: Blob;
};

type FFmpegProgressEvent = {
    progress: number;
    time?: number;
};

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

export async function assembleClips(clips: AssembleClip[], onProgress?: (ratio: number) => void): Promise<Blob> {
    if (clips.length < 2) {
        throw new Error('Select at least two completed clips to assemble.');
    }

    const inputFiles = clips.map((_, index) => `${index}.mp4`);
    const filesToDelete = [...inputFiles, LIST_FILE, OUTPUT_FILE];
    let ffmpeg: FFmpegRuntime | null = null;
    let progressHandler: ((event: FFmpegProgressEvent) => void) | null = null;

    try {
        onProgress?.(0);
        const [{ fetchFile }, loadedFFmpeg] = await Promise.all([import('@ffmpeg/util'), getFFmpeg()]);
        ffmpeg = loadedFFmpeg;

        if (onProgress) {
            progressHandler = ({ progress }) => {
                onProgress(clampProgress(0.1 + progress * 0.85));
            };
            ffmpeg.on('progress', progressHandler);
        }

        for (let index = 0; index < clips.length; index += 1) {
            await ffmpeg.writeFile(inputFiles[index], await fetchFile(clips[index].blob));
            onProgress?.(clampProgress(((index + 1) / clips.length) * 0.1));
        }

        await ffmpeg.writeFile(
            LIST_FILE,
            new TextEncoder().encode(inputFiles.map((file) => `file '${file}'`).join('\n'))
        );

        const exitCode = await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', LIST_FILE, '-c', 'copy', OUTPUT_FILE]);

        if (exitCode !== 0) {
            throw new Error(`FFmpeg exited with code ${exitCode}.`);
        }

        const output = await ffmpeg.readFile(OUTPUT_FILE);
        onProgress?.(1);
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
