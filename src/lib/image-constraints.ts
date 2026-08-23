const MAX_ASSET_BYTES = 30 * 1024 * 1024;
const MIN_ASSET_SIDE = 300;
const MAX_ASSET_SIDE = 6000;
const MIN_ASSET_RATIO = 0.4;
const MAX_ASSET_RATIO = 2.5;

const ACCEPTED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/bmp',
    'image/x-ms-bmp',
    'image/tiff',
    'image/gif',
    'image/heic',
    'image/heif'
]);

export type AssetImageRejectionReason = 'mime' | 'bytes' | 'dimensions' | 'ratio';

export type AssetImageValidationResult =
    | {
          status: 'ok';
          width: number;
          height: number;
          bytes: number;
          mime: string;
      }
    | {
          status: 'rejected';
          reason: AssetImageRejectionReason;
          message: string;
      }
    | {
          status: 'unknown';
          message: string;
      };

function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanMime(type: string): string {
    return type.split(';')[0]?.trim().toLowerCase() ?? '';
}

function validateMime(mime: string): AssetImageValidationResult | null {
    if (!mime) return null;
    if (ACCEPTED_IMAGE_TYPES.has(mime)) return null;
    return {
        status: 'rejected',
        reason: 'mime',
        message: `This file is ${mime}. BytePlus accepts JPEG, PNG, WebP, BMP, TIFF, GIF, HEIC, or HEIF images.`
    };
}

function validateBytes(bytes: number): AssetImageValidationResult | null {
    if (bytes < MAX_ASSET_BYTES) return null;
    return {
        status: 'rejected',
        reason: 'bytes',
        message: `This image is ${formatBytes(bytes)}. BytePlus requires image assets to be under 30 MB.`
    };
}

function validateDimensions(width: number, height: number): AssetImageValidationResult | null {
    if (width < MIN_ASSET_SIDE || width > MAX_ASSET_SIDE || height < MIN_ASSET_SIDE || height > MAX_ASSET_SIDE) {
        return {
            status: 'rejected',
            reason: 'dimensions',
            message: `This image is ${width}×${height}. BytePlus requires width and height each between 300 and 6000 px.`
        };
    }

    const ratio = width / height;
    if (ratio <= MIN_ASSET_RATIO || ratio >= MAX_ASSET_RATIO) {
        return {
            status: 'rejected',
            reason: 'ratio',
            message: `This image is ${width}×${height} (ratio ${ratio.toFixed(2)}). BytePlus requires width ÷ height strictly between 0.4 and 2.5.`
        };
    }

    return null;
}

async function dimensionsFromObjectUrl(url: string): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => resolve(null);
        image.src = url;
    });
}

async function dimensionsFromBlob(blob: Blob): Promise<{ width: number; height: number } | null> {
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(blob);
            const dimensions = { width: bitmap.width, height: bitmap.height };
            bitmap.close();
            return dimensions;
        } catch {
            // Fall through to <img>; Safari and HEIC/TIFF support vary.
        }
    }

    const url = URL.createObjectURL(blob);
    try {
        return await dimensionsFromObjectUrl(url);
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function inspectBlob(blob: Blob): Promise<AssetImageValidationResult> {
    const mime = cleanMime(blob.type);
    const mimeProblem = validateMime(mime);
    if (mimeProblem) return mimeProblem;

    const byteProblem = validateBytes(blob.size);
    if (byteProblem) return byteProblem;

    const dimensions = await dimensionsFromBlob(blob);
    if (!dimensions) {
        return {
            status: 'unknown',
            message: 'Could not inspect this image before upload. BytePlus will validate it after submission.'
        };
    }

    const dimensionProblem = validateDimensions(dimensions.width, dimensions.height);
    if (dimensionProblem) return dimensionProblem;

    return {
        status: 'ok',
        width: dimensions.width,
        height: dimensions.height,
        bytes: blob.size,
        mime
    };
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return null;
        return response.blob();
    } catch {
        return null;
    }
}

export async function validateAssetImage(input: Blob | string): Promise<AssetImageValidationResult> {
    if (typeof input !== 'string') {
        return inspectBlob(input);
    }

    const blob = await fetchImageBlob(input);
    if (blob) {
        return inspectBlob(blob);
    }

    const dimensions = await dimensionsFromObjectUrl(input);
    if (!dimensions) {
        return {
            status: 'unknown',
            message:
                'Could not inspect this image before upload. Cross-origin image hosts can block browser inspection, so BytePlus will validate it after submission.'
        };
    }

    const dimensionProblem = validateDimensions(dimensions.width, dimensions.height);
    if (dimensionProblem) return dimensionProblem;

    return {
        status: 'unknown',
        message:
            'Could not inspect this image size or MIME type before upload. BytePlus will validate it after submission.'
    };
}
