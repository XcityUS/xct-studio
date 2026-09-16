type CaptionImage = {
    blob: Blob;
    start: number;
    end: number;
};

function parseTime(value: string) {
    const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(value.trim());
    if (!match) return NaN;
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function parseSrt(srt: string) {
    return srt
        .trim()
        .split(/\r?\n\r?\n+/)
        .flatMap((block) => {
            const lines = block.split(/\r?\n/);
            const timingIndex = lines.findIndex((line) => line.includes('-->'));
            if (timingIndex < 0) return [];
            const [rawStart, rawEnd] = lines[timingIndex].split('-->');
            const start = parseTime(rawStart);
            const end = parseTime(rawEnd);
            const text = lines
                .slice(timingIndex + 1)
                .map((line) => line.trim())
                .filter(Boolean);
            return Number.isFinite(start) && Number.isFinite(end) && end > start && text.length
                ? [{ start, end, text }]
                : [];
        });
}

async function videoDimensions(film: Blob) {
    const url = URL.createObjectURL(film);
    try {
        const video = document.createElement('video');
        const loaded = new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => reject(new Error('Could not inspect video dimensions.'));
        });
        video.preload = 'metadata';
        video.src = url;
        await loaded;
        return { width: video.videoWidth || 1280, height: video.videoHeight || 720 };
    } finally {
        URL.revokeObjectURL(url);
    }
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const units = text.includes(' ') ? text.split(/\s+/) : Array.from(text);
    const separator = text.includes(' ') ? ' ' : '';
    const lines: string[] = [];
    let current = '';
    units.forEach((unit) => {
        const next = current ? `${current}${separator}${unit}` : unit;
        if (current && ctx.measureText(next).width > maxWidth) {
            lines.push(current);
            current = unit;
        } else current = next;
    });
    if (current) lines.push(current);
    return lines;
}

async function renderCaption(width: number, height: number, sourceLines: string[]) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create caption canvas.');
    const preferredFontSize = Math.max(18, Math.round(Math.min(width, height) * 0.046));
    const minimumFontSize = Math.max(11, Math.round(Math.min(width, height) * 0.022));
    const availableHeight = height * 0.68;
    let fontSize = preferredFontSize;
    let lineHeight = Math.round(fontSize * 1.28);
    let lines: string[] = [];
    do {
        ctx.font = `600 ${fontSize}px Arial, "PingFang SC", "Microsoft YaHei", sans-serif`;
        lineHeight = Math.round(fontSize * 1.28);
        lines = sourceLines.flatMap((line) => wrapLine(ctx, line, width * 0.84));
        if (lines.length * lineHeight <= availableHeight || fontSize <= minimumFontSize) break;
        fontSize = Math.max(minimumFontSize, fontSize - 2);
    } while (fontSize >= minimumFontSize);
    const firstY = Math.max(lineHeight / 2, height * 0.88 - (lines.length - 1) * lineHeight);
    const tokens = getComputedStyle(document.documentElement);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.16));
    ctx.strokeStyle = tokens.getPropertyValue('--studio-media-caption-outline').trim();
    ctx.fillStyle = tokens.getPropertyValue('--studio-media-caption-foreground').trim();
    lines.forEach((line, index) => {
        const y = firstY + index * lineHeight;
        ctx.strokeText(line, width / 2, y);
        ctx.fillText(line, width / 2, y);
    });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not render caption image.');
    return blob;
}

export async function createCaptionImages(film: Blob, srt: string): Promise<CaptionImage[]> {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
        throw new Error('Caption burn-in needs a browser canvas.');
    }
    const cues = parseSrt(srt);
    if (!cues.length) throw new Error('Caption timeline is empty.');
    const { width, height } = await videoDimensions(film);
    return Promise.all(cues.map(async (cue) => ({ ...cue, blob: await renderCaption(width, height, cue.text) })));
}
