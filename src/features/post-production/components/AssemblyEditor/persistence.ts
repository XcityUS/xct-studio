import type { ClipRow, ExportFormatId } from './types';
import { ASSEMBLY_PREFIX } from '@/features/persistence/codec';
import { businessStorage, saveBusinessRecord } from '@/features/persistence/store';
import { isObject } from '@/features/persistence/validation';
import type { VideoMetadata } from '@/shared/contracts/video';
import { useEffect } from 'react';

type AssemblyDraft = {
    rows: { id: string; inValue: string; outValue: string }[];
    selectedBgmKey: string;
    bgmVolume: number;
    burnCaptions: boolean;
    downloadSrtOnly: boolean;
    exportFormat: ExportFormatId;
};

export function assemblyKey(items: VideoMetadata[]): string {
    return ASSEMBLY_PREFIX + JSON.stringify(items.map((item) => item.id).sort());
}

export function readAssembly(items: VideoMetadata[]): AssemblyDraft | null {
    try {
        const value: unknown = JSON.parse(businessStorage.getItem(assemblyKey(items)) ?? 'null');
        if (
            !isObject(value) ||
            !Array.isArray(value.rows) ||
            typeof value.selectedBgmKey !== 'string' ||
            typeof value.bgmVolume !== 'number' ||
            !['original', 'vertical', 'square', 'widescreen'].includes(String(value.exportFormat))
        )
            return null;
        return value as unknown as AssemblyDraft;
    } catch {
        return null;
    }
}

export function restoreRows(rows: ClipRow[], draft: AssemblyDraft | null): ClipRow[] {
    if (!draft) return rows;
    return draft.rows.flatMap((saved) => {
        const row = rows.find((item) => item.id === saved.id);
        return row ? [{ ...row, inValue: saved.inValue, outValue: saved.outValue }] : [];
    });
}

export function useAssemblyPersistence(items: VideoMetadata[], enabled: boolean, draft: AssemblyDraft) {
    const payload = JSON.stringify(draft);
    const key = assemblyKey(items);
    useEffect(() => {
        if (enabled && draft.rows.length) businessStorage.setItem(key, payload);
    }, [enabled, key, payload, draft.rows.length]);
}

export function rememberExport(key: string, filename: string, settings: unknown) {
    saveBusinessRecord({
        table: 'exports',
        scope: key,
        id: crypto.randomUUID(),
        baseRevision: 0,
        data: {
            filename,
            status: 'downloaded',
            createdAt: new Date().toISOString(),
            settings: JSON.stringify(settings)
        }
    });
}
