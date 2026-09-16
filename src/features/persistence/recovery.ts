import type { BusinessChange } from '@/shared/contracts/business-data';

type StoredOutbox = { name: string; raw: string };

export function preserveConflictOutboxes(
    owner: string,
    changes: BusinessChange[],
    storage: Storage = localStorage
): string {
    const legacyKey = `xctStudioPending:${owner}`;
    const currentPrefix = `xctStudioPending:v2:${owner}:`;
    const outboxes: StoredOutbox[] = Object.keys(storage)
        .filter((name) => name === legacyKey || name.startsWith(currentPrefix))
        .map((name) => ({ name, raw: storage.getItem(name) }))
        .filter((item): item is StoredOutbox => item.raw !== null);
    const recoveryKey = `${legacyKey}:recovery:${Date.now()}:${crypto.randomUUID()}`;

    storage.setItem(recoveryKey, JSON.stringify({ changes, outboxes }));
    for (const { name, raw } of outboxes) {
        if (storage.getItem(name) === raw) storage.removeItem(name);
    }
    return recoveryKey;
}
