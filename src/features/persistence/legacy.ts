import { encodeDocument, HISTORY_KEY, supportedKey } from './codec';
import { isObject } from './validation';
import { recordKey, type BusinessChange } from '@/shared/contracts/business-data';

export const LEGACY_OWNER_KEY = 'xctStudioLegacyDataOwner';

export function collectLegacy(owner: string): { changes: BusinessChange[]; invalid: string[]; eligible: boolean } {
    const previousOwner = localStorage.getItem(LEGACY_OWNER_KEY);
    if (previousOwner && previousOwner !== owner) return { changes: [], invalid: [], eligible: false };
    // Claim before sending: a later account must never import this browser's legacy data again.
    localStorage.setItem(LEGACY_OWNER_KEY, owner);
    const changes = new Map<string, BusinessChange>();
    const invalid: string[] = [];
    for (const key of Object.keys(localStorage).filter(supportedKey)) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) continue;
            for (const change of encodeDocument(key, raw)) changes.set(recordKey(change), change);
            if (key === HISTORY_KEY) {
                const old: unknown = JSON.parse(raw);
                if (isObject(old)) {
                    for (const [field, target] of Object.entries({
                        characters: 'soraVideoCharacters',
                        portraits: 'soraVideoPortraits',
                        declarations: 'soraReferenceDeclarations',
                        deletedIds: 'soraVideoDeletedIds'
                    })) {
                        if (old[field] && !localStorage.getItem(target)) {
                            for (const change of encodeDocument(target, JSON.stringify(old[field])))
                                changes.set(recordKey(change), change);
                        }
                    }
                }
            }
        } catch {
            invalid.push(key);
        }
    }
    const tombstones = changes.get(JSON.stringify(['user_preferences', 'preferences', 'soraVideoDeletedIds']))?.data
        ?.value;
    if (Array.isArray(tombstones)) {
        for (const id of tombstones)
            if (typeof id === 'string') {
                for (const [table, scope] of [
                    ['generation_jobs', 'history'],
                    ['generation_results', 'history'],
                    ['characters', 'library'],
                    ['provider_assets', 'library']
                ] as const) {
                    const change: BusinessChange = { table, scope, id, data: null, baseRevision: 0 };
                    changes.set(recordKey(change), change);
                }
            }
    }
    return { changes: [...changes.values()], invalid, eligible: true };
}
