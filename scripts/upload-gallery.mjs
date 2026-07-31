#!/usr/bin/env node
/**
 * Publishes one showcase clip to R2 under `gallery/v1/{slug}/`.
 *
 * Given a source video it derives the two lighter assets the gallery needs —
 * a poster still and a short muted preview loop — then uploads all three via
 * wrangler. The grid plays the preview on hover, not the full clip: thirty
 * 1080p originals loading on a single page would cost far more bandwidth than
 * the wall is worth.
 *
 * Usage:
 *   node scripts/upload-gallery.mjs <video-file> <slug>
 *   node scripts/upload-gallery.mjs ./clips/koi.mp4 golden-koi
 *
 * Requires: ffmpeg on PATH, and wrangler authenticated for the xcity-media
 * bucket (same credentials used to deploy media-worker).
 *
 * After uploading, add the matching entry to src/data/gallery.ts — the
 * manifest is typed, so `npm run build` will reject an impossible
 * model/resolution pair before a user ever sees it. This script prints a
 * ready-to-paste stub with the real dimensions filled in.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BUCKET = process.env.GALLERY_BUCKET || 'xcity-media';
const PREFIX = 'gallery/v1';
const PREVIEW_SECONDS = 3;

const [source, slug] = process.argv.slice(2);

if (!source || !slug) {
    console.error('usage: node scripts/upload-gallery.mjs <video-file> <slug>');
    process.exit(1);
}
if (!existsSync(source)) {
    console.error(`no such file: ${source}`);
    process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    console.error(`slug must be lowercase alphanumeric with dashes: ${slug}`);
    process.exit(1);
}

function run(cmd, args) {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function probeDimensions(file) {
    const out = run('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-of', 'csv=s=x:p=0',
        file
    ]).trim();
    const [width, height] = out.split('x').map(Number);
    return { width, height };
}

const work = mkdtempSync(path.join(tmpdir(), 'xct-gallery-'));

try {
    const { width, height } = probeDimensions(source);
    console.log(`source: ${width}x${height}`);

    const poster = path.join(work, 'poster.webp');
    const preview = path.join(work, 'preview.mp4');

    // Seek a little in: the very first frame is often black on encoded output.
    console.log('extracting poster…');
    run('ffmpeg', ['-y', '-ss', '0.5', '-i', source, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '80', poster]);

    console.log('encoding hover preview…');
    run('ffmpeg', [
        '-y', '-i', source,
        '-t', String(PREVIEW_SECONDS),
        '-an',                                   // muted: hover previews must never make noise
        '-vf', 'scale=854:-2',                   // 480p-class
        '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast',
        '-movflags', '+faststart',               // playable before fully downloaded
        preview
    ]);

    const uploads = [
        [source, `${PREFIX}/${slug}/video.mp4`, 'video/mp4'],
        [preview, `${PREFIX}/${slug}/preview.mp4`, 'video/mp4'],
        [poster, `${PREFIX}/${slug}/poster.webp`, 'image/webp']
    ];

    for (const [file, key, contentType] of uploads) {
        console.log(`uploading ${key}…`);
        run('npx', [
            'wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`,
            '--file', file,
            '--content-type', contentType,
            '--cache-control', 'public, max-age=31536000, immutable',
            '--remote'
        ]);
    }

    console.log(`\n✓ uploaded ${slug}\n\nAdd to src/data/gallery.ts:\n`);
    console.log(`    {
        slug: '${slug}',
        title: 'TODO',
        category: 'landscape',
        params: {
            model: 'seedance-1-5-pro-251215',
            prompt: 'TODO — the prompt this clip was generated from',
            ratio: '16:9',
            resolution: '720p',
            seconds: 5,
            generate_audio: false
        },
        media: {
            poster: '${PREFIX}/${slug}/poster.webp',
            preview: '${PREFIX}/${slug}/preview.mp4',
            video: '${PREFIX}/${slug}/video.mp4'
        },
        dimensions: { width: ${width}, height: ${height} }
    },`);
} finally {
    rmSync(work, { recursive: true, force: true });
}
