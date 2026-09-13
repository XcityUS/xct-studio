import type { ClipRow, ClipValidation } from './types';
import { usesDefaultTrim } from './utils';
import type { AssembleClip } from '@/features/post-production/assembly/client';

export function assemblyClips(rows: ClipRow[], validations: Map<string, ClipValidation>): AssembleClip[] {
    return rows.map((row) => {
        const validation = validations.get(row.id);
        if (!row.blob || typeof row.duration !== 'number' || !validation || validation.error) {
            throw new Error('Assembly is not ready to export.');
        }
        return {
            id: row.id,
            blob: row.blob,
            ...(usesDefaultTrim(validation, row.duration)
                ? {}
                : { inTime: validation.inTime, outTime: validation.outTime })
        };
    });
}
