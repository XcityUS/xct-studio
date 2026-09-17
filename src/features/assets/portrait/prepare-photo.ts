import { validateAssetImage } from '@/features/assets/image/validation';

const MIN_SIDE = 300;
const MIN_AUTO_RESIZE_SIDE = 280;
const MAX_SIDE = 6000;
const RESIZABLE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function uploadMime(file: File): string {
    if (file.type === 'image/jpg') return 'image/jpeg';
    if (file.type) return file.type;
    if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg';
    if (/\.png$/i.test(file.name)) return 'image/png';
    if (/\.webp$/i.test(file.name)) return 'image/webp';
    return '';
}

export function resizedVerifiedPhotoSize(width: number, height: number): { width: number; height: number } | null {
    const shortest = Math.min(width, height);
    const longest = Math.max(width, height);
    const ratio = width / height;
    if (shortest >= MIN_SIDE || shortest < MIN_AUTO_RESIZE_SIDE || longest > MAX_SIDE || ratio <= 0.4 || ratio >= 2.5) {
        return null;
    }
    const scale = MIN_SIDE / shortest;
    const target = { width: Math.ceil(width * scale), height: Math.ceil(height * scale) };
    return Math.max(target.width, target.height) <= MAX_SIDE ? target : null;
}

async function loadPhoto(
    file: File
): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file);
            return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
        } catch {
            // Fall back to the image element for browsers with incomplete bitmap support.
        }
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('Could not read this image.'));
            image.src = url;
        });
    } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
    }
    return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => URL.revokeObjectURL(url)
    };
}

export async function prepareVerifiedPhoto(file: File): Promise<File> {
    const validation = await validateAssetImage(file);
    const type = uploadMime(file);
    if (validation.status !== 'rejected') {
        if (validation.status === 'ok' && type && type !== file.type) {
            return new File([file], file.name, { type, lastModified: file.lastModified });
        }
        return file;
    }
    if (validation.reason !== 'dimensions' || !RESIZABLE_TYPES.has(type)) throw new Error(validation.message);

    const photo = await loadPhoto(file);
    try {
        const target = resizedVerifiedPhotoSize(photo.width, photo.height);
        if (!target) throw new Error(validation.message);
        const canvas = document.createElement('canvas');
        canvas.width = target.width;
        canvas.height = target.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not resize this image.');
        context.drawImage(photo.source, 0, 0, target.width, target.height);
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (result) => (result ? resolve(result) : reject(new Error('Could not resize this image.'))),
                type,
                0.92
            );
        });
        const prepared = new File([blob], file.name, { type, lastModified: file.lastModified });
        const result = await validateAssetImage(prepared);
        if (result.status === 'rejected') throw new Error(result.message);
        return prepared;
    } finally {
        photo.close();
    }
}
