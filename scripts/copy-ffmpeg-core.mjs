import { access, copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const sourceDir = join(rootDir, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const targetDir = join(rootDir, 'public', 'ffmpeg');
const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

try {
    await access(sourceDir);
} catch {
    console.warn('Skipping ffmpeg core copy: node_modules/@ffmpeg/core/dist/umd was not found.');
    process.exit(0);
}

await mkdir(targetDir, { recursive: true });

for (const file of files) {
    const source = join(sourceDir, file);
    const target = join(targetDir, file);

    try {
        await access(source);
    } catch {
        throw new Error(`Missing expected ffmpeg core asset: ${source}`);
    }

    await copyFile(source, target);
}

console.log(`Copied ffmpeg core assets to ${targetDir}`);
