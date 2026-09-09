import type { ScriptFileExtraction } from '@/features/script/types';

type ErrorEnvelope = {
    error?: {
        code?: string;
        message?: string;
    };
};

export class ScriptImportError extends Error {
    constructor(
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'ScriptImportError';
    }
}

export async function extractScriptFile(file: File): Promise<ScriptFileExtraction> {
    const form = new FormData();
    form.set('file', file);

    const response = await fetch('/api/script/extract', {
        method: 'POST',
        body: form
    });
    const body = (await response.json().catch(() => ({}))) as ScriptFileExtraction & ErrorEnvelope;

    if (!response.ok) {
        throw new ScriptImportError(
            body.error?.code || 'IMPORT_FAILED',
            body.error?.message || 'Could not read this script file.'
        );
    }
    if (!body.text?.trim()) {
        throw new ScriptImportError('EMPTY_FILE', 'The script file did not contain readable text.');
    }

    return { filename: body.filename || file.name, text: body.text };
}
