import { fetchSnapshot, PersistenceError, postChanges } from './api';
import { allDocumentKeys, decodeDocument, encodeDocument } from './codec';
import { collectLegacy } from './legacy';
import { prepareMediaCache } from './media-cache';
import { localMigrationComplete, markLocalMigrationComplete } from './startup';
import { validateChange } from './validation';
import { recordKey, type BusinessChange, type BusinessRecord } from '@/shared/contracts/business-data';

type StartupStage = 'database' | 'validation' | 'import' | 'legacy' | 'media' | 'ready';
type SyncStatus = {
    ready: boolean; owner: string; pending: number; error: string | null; invalid: number;
    stage: StartupStage; progress: number; processed: number; total: number; startedAt: number; migrating: boolean;
};
let status: SyncStatus = {
    ready: false, owner: '', pending: 0, error: null, invalid: 0,
    stage: 'database', progress: 0, processed: 0, total: 0, startedAt: 0, migrating: false
};
let key = '';
let epoch = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> | null = null;
const records = new Map<string, BusinessRecord>();
const pending = new Map<string, BusinessChange>();
const listeners = new Set<() => void>();
const legacyOutboxKey = (owner: string) => `xctStudioPending:${owner}`;
const outboxPrefix = (owner: string) => `xctStudioPending:v2:${owner}:`;
const localPendingIds = new Set<string>();

function tabId(): string {
    const storageKey = 'xctStudioPersistenceTabId';
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(storageKey, created);
    return created;
}

const outboxKey = () => `${outboxPrefix(status.owner)}${tabId()}`;

export function stableJson(value: unknown): string {
    return JSON.stringify(value, (_name, item: unknown) =>
        item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
            : item
    );
}

function publish(update: Partial<SyncStatus> = {}) {
    status = { ...status, ...update, pending: pending.size };
    listeners.forEach((listener) => listener());
}

function persistPending() {
    try {
        const changes = [...localPendingIds].flatMap((id) => pending.get(id) ? [pending.get(id)!] : []);
        if (changes.length) localStorage.setItem(outboxKey(), JSON.stringify({ updatedAt: Date.now(), changes }));
        else localStorage.removeItem(outboxKey());
    } catch {
        publish({ error: 'LOCAL_BACKUP_FAILED' });
    }
}

function parsedOutbox(raw: string): { updatedAt: number; changes: BusinessChange[] } {
    const parsed: unknown = JSON.parse(raw);
    const value = Array.isArray(parsed)
        ? { updatedAt: 0, changes: parsed }
        : parsed && typeof parsed === 'object' && 'changes' in parsed
          ? parsed as { updatedAt?: unknown; changes?: unknown }
          : null;
    if (!value || !Array.isArray(value.changes)) throw new Error('INVALID_OUTBOX');
    return {
        updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
        changes: value.changes.map(validateChange)
    };
}

function clearAcknowledgedOutboxes(sent: Map<string, BusinessChange>) {
    const owner = status.owner;
    for (const name of Object.keys(localStorage)) {
        if (name !== legacyOutboxKey(owner) && !name.startsWith(outboxPrefix(owner))) continue;
        const raw = localStorage.getItem(name);
        if (!raw) continue;
        try {
            const stored = parsedOutbox(raw);
            const changes = stored.changes.filter((change) => {
                const acknowledged = sent.get(recordKey(change));
                return !acknowledged || stableJson(acknowledged) !== stableJson(change);
            });
            if (localStorage.getItem(name) !== raw) continue;
            if (changes.length) localStorage.setItem(name, JSON.stringify({ updatedAt: stored.updatedAt, changes }));
            else localStorage.removeItem(name);
        } catch {
            // Preserve malformed recovery data for manual inspection.
        }
    }
}

export function subscribeBusiness(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
export const businessStatus = () => status;
export const businessOwner = () => status.owner;
export const businessSessionMatches = (apiKey: string | null) => Boolean(apiKey && key === apiKey && status.ready);
export const businessRecords = () => [...records.values()];

function queueChange(change: BusinessChange): boolean {
    const id = recordKey(change);
    const current = records.get(id);
    if (current && stableJson(current.data) === stableJson(change.data)) return false;
    const previous = pending.get(id);
    const next = { ...change, baseRevision: previous?.baseRevision ?? current?.revision ?? 0 };
    pending.set(id, next);
    localPendingIds.add(id);
    records.set(id, {
        table: change.table,
        scope: change.scope,
        id: change.id,
        data: change.data,
        revision: current?.revision ?? 0
    });
    return true;
}

export function saveBusinessRecord(change: BusinessChange) {
    if (!status.ready) throw new PersistenceError('DATABASE_NOT_READY');
    if (!queueChange(validateChange(change))) return;
    persistPending();
    publish();
    schedule();
}

async function queueRequest(input: Record<string, string>): Promise<BusinessRecord> {
    await flushBusiness();
    const response = await fetch('/api/business/queue', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) {
        const error = input.action === 'release' ? 'QUEUE_CLAIM_CHANGED' : 'QUEUE_ALREADY_CLAIMED';
        publish({ error });
        throw new PersistenceError(error);
    }
    const result = (await response.json()) as { record: BusinessRecord };
    records.set(recordKey(result.record), result.record);
    return result.record;
}

export async function claimBusinessQueue(id: string): Promise<string> {
    const record = await queueRequest({ action: 'claim', id });
    const execution = record.data?.execution;
    if (!execution || typeof execution !== 'object' || Array.isArray(execution) || typeof execution.attemptId !== 'string')
        throw new PersistenceError('INVALID_RESPONSE');
    return execution.attemptId;
}

export async function releaseBusinessQueue(id: string, attemptId: string): Promise<void> {
    await queueRequest({ action: 'release', id, attemptId });
}

export const businessStorage = {
    getItem(name: string): string | null {
        return status.ready ? decodeDocument(name, [...records.values()]) : null;
    },
    setItem(name: string, value: string): void {
        if (!status.ready) throw new PersistenceError('DATABASE_NOT_READY');
        const before = businessStorage.getItem(name);
        const old = before === null ? [] : encodeDocument(name, before);
        const next = encodeDocument(name, value);
        const ids = new Set(next.map(recordKey));
        let changed = false;
        for (const item of old)
            if (!ids.has(recordKey(item))) changed = queueChange({ ...item, data: null }) || changed;
        for (const item of next) changed = queueChange(item) || changed;
        if (!changed) return;
        persistPending();
        publish();
        schedule();
    },
    removeItem(name: string): void {
        const before = businessStorage.getItem(name);
        if (before === null) return;
        for (const item of encodeDocument(name, before)) queueChange({ ...item, data: null });
        persistPending();
        publish();
        schedule();
    }
};

function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
        void flushBusiness().catch(() => undefined);
    }, 150);
}

export function flushBusiness(): Promise<void> {
    if (saving) return saving;
    if (!pending.size || !status.ready) return Promise.resolve();
    if (status.error === 'DATABASE_BUSY' || status.error === 'DATABASE_TIMEOUT' || status.error === 'DATABASE_UNAVAILABLE')
        publish({ error: null });
    const token = epoch;
    const apiKey = key;
    saving = (async () => {
        while (pending.size && status.ready && token === epoch) {
            const changes = [...pending.values()].slice(0, 150);
            const sent = new Map(changes.map((change) => [recordKey(change), change]));
            const result = await postChanges(apiKey, { mode: 'write', changes });
            if (token !== epoch) return;
            const acknowledged = new Set(result.records.map(recordKey));
            if (acknowledged.size !== changes.length || changes.some((change) => !acknowledged.has(recordKey(change))))
                throw new PersistenceError('INVALID_RESPONSE');
            for (const row of result.records) {
                const id = recordKey(row);
                const queued = pending.get(id);
                if (queued === sent.get(id)) {
                    pending.delete(id);
                    localPendingIds.delete(id);
                    records.set(id, row);
                } else if (queued) {
                    pending.set(id, { ...queued, baseRevision: row.revision });
                    records.set(id, { ...row, data: queued.data });
                }
            }
            clearAcknowledgedOutboxes(sent);
            persistPending();
            publish({ error: null });
        }
    })()
        .catch((error: unknown) => {
            if (token === epoch)
                publish({ error: error instanceof PersistenceError ? error.code : 'DATABASE_UNAVAILABLE' });
            throw error;
        })
        .finally(() => {
            if (token === epoch) saving = null;
        });
    return saving;
}

export async function startBusiness(apiKey: string): Promise<void> {
    const token = ++epoch;
    if (timer) clearTimeout(timer);
    key = apiKey;
    saving = null;
    records.clear();
    pending.clear();
    localPendingIds.clear();
    publish({
        ready: false, owner: '', error: null, invalid: 0,
        stage: 'database', progress: 0, processed: 0, total: 0, startedAt: Date.now(), migrating: false
    });
    try {
        let snapshot = await fetchSnapshot(apiKey);
        if (token !== epoch) return;
        const migrated = localMigrationComplete(snapshot.owner);
        publish({ owner: snapshot.owner, stage: 'validation', progress: 20, migrating: !migrated });
        const legacy = migrated ? { changes: [], invalid: [] } : collectLegacy(snapshot.owner);
        const existing = new Set(snapshot.records.map(recordKey));
        const missing = legacy.changes.filter((item) => !existing.has(recordKey(item)));
        publish({ stage: 'import', progress: 40, total: missing.length, invalid: legacy.invalid.length });
        for (let offset = 0; offset < missing.length; offset += 150) {
            if (token !== epoch) return;
            await postChanges(apiKey, { mode: 'import', changes: missing.slice(offset, offset + 150) });
            if (token !== epoch) return;
            const processed = Math.min(offset + 150, missing.length);
            publish({ processed, progress: 40 + 20 * processed / missing.length });
        }
        if (token !== epoch) return;
        publish({ stage: 'legacy', progress: 60 });
        const legacyImported = snapshot.records.some((record) =>
            record.table === 'user_preferences' && record.scope === 'migration' && record.id === 'worker-history'
        );
        if (!legacyImported) {
            const legacyResponse = await fetch('/api/business/legacy', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}` },
                signal: AbortSignal.timeout(30000)
            });
            if (!legacyResponse.ok) {
                if (legacyResponse.status === 401) throw new PersistenceError('AUTH_REQUIRED');
                throw new PersistenceError('LEGACY_IMPORT_UNAVAILABLE');
            }
        }
        if (token !== epoch) return;
        // Imports can change the snapshot; ordinary subsequent visits need only one read.
        if (missing.length || !legacyImported) snapshot = await fetchSnapshot(apiKey);
        if (token !== epoch) return;
        snapshot.records.forEach((record) => records.set(recordKey(record), record));
        let invalid = legacy.invalid.length;
        const storedOutboxes = Object.keys(localStorage)
            .filter((name) => name === legacyOutboxKey(snapshot.owner) || name.startsWith(outboxPrefix(snapshot.owner)))
            .map((name) => ({ name, raw: localStorage.getItem(name) }))
            .filter((item): item is { name: string; raw: string } => item.raw !== null)
            .map((item) => {
                try {
                    return { ...item, parsed: parsedOutbox(item.raw), valid: true as const };
                } catch {
                    return { ...item, parsed: null, valid: false as const };
                }
            })
            .sort((a, b) => (a.parsed?.updatedAt ?? 0) - (b.parsed?.updatedAt ?? 0));
        for (const stored of storedOutboxes) {
            try {
                if (!stored.valid || !stored.parsed) throw new Error('INVALID_OUTBOX');
                for (const change of stored.parsed.changes) {
                    const id = recordKey(change);
                    const current = records.get(id);
                    if (current && stableJson(current.data) === stableJson(change.data)) continue;
                    pending.set(id, change);
                    records.set(id, { ...change, revision: current?.revision ?? 0 });
                }
            } catch {
                invalid += 1;
            }
        }
        publish({ stage: 'media', progress: 80 });
        await prepareMediaCache(snapshot.owner, snapshot.records);
        if (token !== epoch) return;
        publish({ ready: true, invalid, stage: 'ready', progress: 100 });
        if (pending.size) await flushBusiness();
        if (token !== epoch) return;
        if (!migrated && invalid === 0) markLocalMigrationComplete(snapshot.owner);
        for (const name of allDocumentKeys([...records.values()])) {
            window.dispatchEvent(new StorageEvent('storage', { key: name }));
        }
    } catch (error) {
        if (token === epoch)
            publish({ error: error instanceof PersistenceError ? error.code : 'DATABASE_UNAVAILABLE' });
        throw error;
    }
}

export function stopBusiness() {
    ++epoch;
    key = '';
    if (timer) clearTimeout(timer);
    records.clear();
    pending.clear();
    localPendingIds.clear();
    saving = null;
    publish({
        ready: false, owner: '', error: null,
        stage: 'database', progress: 0, processed: 0, total: 0, startedAt: 0, migrating: false
    });
}

export async function loadDatabaseVersion(): Promise<void> {
    // Keep the conflicting edits recoverable instead of silently throwing them away.
    localStorage.setItem(`${legacyOutboxKey(status.owner)}:recovery:${Date.now()}`, JSON.stringify([...pending.values()]));
    for (const name of Object.keys(localStorage))
        if (name === legacyOutboxKey(status.owner) || name.startsWith(outboxPrefix(status.owner))) localStorage.removeItem(name);
    await startBusiness(key);
}
