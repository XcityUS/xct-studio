import { displayNameForAsset } from './utils';
import { type UserAsset } from '@/lib/media-archive';

export function extensionFromPath(value: string | null | undefined) {
    if (!value) return undefined;
    const clean = value.split(/[?#]/)[0];
    const match = /\.([a-z0-9]{1,8})$/i.exec(clean);
    return match?.[1]?.toLowerCase();
}

export function extensionFromMime(mimeType: string) {
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

export function mimeFromExtension(extension: string) {
    const byExtension: Record<string, string> = {
        aac: 'audio/aac',
        flac: 'audio/flac',
        m4a: 'audio/mp4',
        mp3: 'audio/mpeg',
        ogg: 'audio/ogg',
        wav: 'audio/wav',
        webm: 'audio/webm'
    };

    return byExtension[extension];
}

export function extensionForAsset(asset: UserAsset, mimeType: string) {
    return extensionFromPath(asset.key) ?? extensionFromPath(asset.name) ?? extensionFromMime(mimeType) ?? 'mp3';
}

export async function fetchBgmBlob(asset: UserAsset): Promise<Blob> {
    const response = await fetch(asset.url);
    if (!response.ok) {
        throw new Error(`Could not load ${displayNameForAsset(asset)} (${response.status}).`);
    }

    const blob = await response.blob();
    const extension = extensionForAsset(asset, blob.type);
    const type = blob.type || mimeFromExtension(extension) || 'audio/mpeg';

    if (typeof File === 'undefined') {
        return new Blob([blob], { type });
    }

    return new File([blob], `bgm.${extension}`, { type });
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    try {
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
    } finally {
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

export function downloadSrt(srt: string, filename: string) {
    downloadBlob(new Blob([srt], { type: 'application/x-subrip;charset=utf-8' }), filename);
}

export function downloadXml(xml: string, filename: string) {
    downloadBlob(new Blob([xml], { type: 'application/xml;charset=utf-8' }), filename);
}
