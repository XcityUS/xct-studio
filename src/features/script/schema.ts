import type { ShotDraft } from '@/features/script/types';

export const MAX_SCRIPT_FILE_BYTES = 20 * 1024 * 1024;

const SUPPORTED_SCRIPT_EXTENSIONS = new Set(['txt', 'md', 'doc', 'docx', 'pdf']);

export class ScriptFileError extends Error {
    constructor(
        message: string,
        public readonly code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE' | 'EMPTY_FILE' | 'EXTRACTION_FAILED'
    ) {
        super(message);
        this.name = 'ScriptFileError';
    }
}

export function scriptFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function validateScriptFile(filename: string, size: number): string {
    if (size <= 0) {
        throw new ScriptFileError('The selected script file is empty.', 'EMPTY_FILE');
    }
    if (size > MAX_SCRIPT_FILE_BYTES) {
        throw new ScriptFileError('The script file must be 20 MB or smaller.', 'FILE_TOO_LARGE');
    }

    const extension = scriptFileExtension(filename);
    if (!SUPPORTED_SCRIPT_EXTENSIONS.has(extension)) {
        throw new ScriptFileError(
            'Supported script formats are TXT, Markdown, DOC, DOCX, and PDF.',
            'UNSUPPORTED_FILE'
        );
    }
    return extension;
}

export function normalizeShotDrafts(value: unknown): ShotDraft[] {
    const source = Array.isArray(value)
        ? value
        : value && typeof value === 'object' && Array.isArray((value as { shots?: unknown }).shots)
          ? (value as { shots: unknown[] }).shots
          : null;
    if (!source?.length) throw new Error('The model response did not include any shots.');

    return source.slice(0, 20).map((item, index) => {
        if (!item || typeof item !== 'object') throw new Error(`Shot ${index + 1} is invalid.`);
        const record = item as Record<string, unknown>;
        const description = typeof record.description === 'string' ? record.description.trim() : '';
        if (!description) throw new Error(`Shot ${index + 1} is missing a description.`);
        const camera = typeof record.camera === 'string' ? record.camera.trim() : '';
        const audio = typeof record.audio === 'string' ? record.audio.trim() : '';
        const durationRaw = record.durationSeconds ?? record.duration_seconds ?? record.seconds;
        const duration = typeof durationRaw === 'number' ? durationRaw : Number(durationRaw);
        return {
            description,
            ...(camera ? { camera } : {}),
            ...(audio ? { audio } : {}),
            ...(Number.isFinite(duration) && duration > 0 ? { durationSeconds: Math.round(duration) } : {})
        };
    });
}
