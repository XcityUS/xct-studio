import { EXPORT_FORMATS, TIME_EPSILON } from './constants';
import type { ClipRow, ClipValidation, ExportFormatId, ExportFormatOption } from './types';
import { type UserAsset } from '@/lib/media-archive';
import type { VideoMetadata } from '@/shared/contracts/video';

export function formatSeconds(value: number) {
    if (!Number.isFinite(value)) return '0s';
    return `${Number(value.toFixed(1)).toString()}s`;
}

export function formatTimeInput(value: number) {
    if (!Number.isFinite(value)) return '';
    return Number(value.toFixed(3)).toString();
}

export function parseSeconds(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    return Number(trimmed);
}

export function displayNameForClip(item: VideoMetadata) {
    return item.filename || `${item.id}.mp4`;
}

export function displayNameForAsset(asset: UserAsset) {
    const assetName = asset.name?.trim();
    if (assetName) return assetName;
    return asset.key.split('/').pop()?.trim() || 'Untitled audio';
}

export function validateClip(row: ClipRow): ClipValidation {
    if (row.error) return { inTime: 0, outTime: 0, error: row.error };
    if (!row.blob || typeof row.duration !== 'number') {
        return { inTime: 0, outTime: 0, error: 'Loading clip metadata.' };
    }

    const inTime = parseSeconds(row.inValue);
    const outTime = parseSeconds(row.outValue);

    if (!Number.isFinite(inTime) || !Number.isFinite(outTime)) {
        return { inTime: 0, outTime: 0, error: 'Enter numeric trim times.' };
    }

    if (inTime < 0) {
        return { inTime, outTime, error: 'In must be 0 or greater.' };
    }

    if (outTime <= inTime) {
        return { inTime, outTime, error: 'Out must be greater than In.' };
    }

    if (outTime - row.duration > TIME_EPSILON) {
        return { inTime, outTime, error: `Out must be ${formatSeconds(row.duration)} or less.` };
    }

    return { inTime, outTime };
}

export function timestampForFilename() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

export function exportBaseName() {
    return `assembled-${timestampForFilename()}`;
}

export function timelineFileName() {
    return `timeline-${timestampForFilename()}.xml`;
}

export function exportFormatById(id: ExportFormatId): ExportFormatOption {
    return EXPORT_FORMATS.find((format) => format.id === id) ?? EXPORT_FORMATS[0];
}

export function usesDefaultTrim(validation: ClipValidation, duration: number) {
    return Math.abs(validation.inTime) <= TIME_EPSILON && Math.abs(validation.outTime - duration) <= TIME_EPSILON;
}
