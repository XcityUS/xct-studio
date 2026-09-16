import type { BusinessChange } from '@/shared/contracts/business-data';

type StoredOutbox = { name: string; raw: string };
type RecoveryCopy = { key: string; createdAt: number; changeCount: number };

const recoveryPrefix = (owner: string) => `xctStudioPending:${owner}:recovery:`;
const recoveryEvent = 'xct-studio-recovery';

export function recoveryCopiesSnapshot(owner: string, storage: Storage = localStorage): string {
    return Object.keys(storage)
        .filter((name) => name.startsWith(recoveryPrefix(owner)))
        .sort()
        .join('\n');
}

export function subscribeRecoveryCopies(listener: () => void): () => void {
    window.addEventListener('storage', listener);
    window.addEventListener(recoveryEvent, listener);
    return () => {
        window.removeEventListener('storage', listener);
        window.removeEventListener(recoveryEvent, listener);
    };
}

export function listRecoveryCopies(owner: string, storage: Storage = localStorage): RecoveryCopy[] {
    const prefix = recoveryPrefix(owner);
    return Object.keys(storage)
        .filter((name) => name.startsWith(prefix))
        .map((key) => {
            const createdAt = Number(key.slice(prefix.length).split(':')[0]);
            const raw = storage.getItem(key);
            let changeCount = 0;
            try {
                const value: unknown = JSON.parse(raw ?? '');
                if (Array.isArray(value)) changeCount = value.length;
                else if (value && typeof value === 'object' && 'changes' in value && Array.isArray(value.changes))
                    changeCount = value.changes.length;
            } catch {
                // Keep malformed copies downloadable instead of hiding them.
            }
            return { key, createdAt: Number.isFinite(createdAt) ? createdAt : 0, changeCount };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
}

export function readRecoveryCopy(owner: string, key: string, storage: Storage = localStorage): string | null {
    return key.startsWith(recoveryPrefix(owner)) ? storage.getItem(key) : null;
}

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
    const recoveryKey = `${recoveryPrefix(owner)}${Date.now()}:${crypto.randomUUID()}`;

    storage.setItem(recoveryKey, JSON.stringify({ changes, outboxes }));
    for (const { name, raw } of outboxes) {
        if (storage.getItem(name) === raw) storage.removeItem(name);
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(recoveryEvent));
    return recoveryKey;
}
