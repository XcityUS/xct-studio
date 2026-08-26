import { access, copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const coreUmdDir = join(rootDir, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const coreEsmDir = join(rootDir, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const ffmpegEsmDir = join(rootDir, 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'esm');
const targetDir = join(rootDir, 'public', 'ffmpeg');
const files = [
    [coreUmdDir, 'ffmpeg-core.js', 'ffmpeg-core.js'],
    [coreUmdDir, 'ffmpeg-core.wasm', 'ffmpeg-core.wasm'],
    [coreEsmDir, 'ffmpeg-core.js', 'ffmpeg-core.esm.js'],
    [ffmpegEsmDir, 'worker.js', 'ffmpeg-worker.js'],
    [ffmpegEsmDir, 'const.js', 'const.js'],
    [ffmpegEsmDir, 'errors.js', 'errors.js']
];

try {
    await Promise.all([access(coreUmdDir), access(coreEsmDir), access(ffmpegEsmDir)]);
} catch {
    console.warn('Skipping ffmpeg asset copy: expected @ffmpeg packages were not found.');
    process.exit(0);
}

await mkdir(targetDir, { recursive: true });

for (const [sourceDir, sourceFile, targetFile] of files) {
    const source = join(sourceDir, sourceFile);
    const target = join(targetDir, targetFile);

    try {
        await access(source);
    } catch {
        throw new Error(`Missing expected ffmpeg core asset: ${source}`);
    }

    await copyFile(source, target);
}

console.log(`Copied ffmpeg core assets to ${targetDir}`);
