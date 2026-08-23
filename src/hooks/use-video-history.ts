'use client';

import { StateConflictError } from '@/lib/errors';
import {
    mergeDocs,
    sameDocContent,
    withDeclarations,
    withTombstones,
    type HistoryDoc,
    type VideoCharacter,
    type VideoPortrait,
    type VideoPortraitGroupType
} from '@/lib/history-merge';
import { fetchCloudState, mediaArchiveEnabled, pushCloudState } from '@/lib/media-archive';
import { REFERENCE_ORIGINS, type ReferenceDeclaration, type ReferenceOrigin } from '@/lib/reference-origin';
import type { VideoMetadata } from '@/types/video';
import * as React from 'react';

/** Kept under the historical name so existing users' history survives. */
const STORAGE_KEY = 'soraVideoHistory';
const UPDATED_AT_KEY = 'soraVideoHistoryUpdatedAt';
const CHARACTERS_KEY = 'soraVideoCharacters';
const PORTRAITS_KEY = 'soraVideoPortraits';
const DECLARATIONS_KEY = 'soraReferenceDeclarations';
const DELETED_IDS_KEY = 'soraVideoDeletedIds';
const SYNC_DEBOUNCE_MS = 3000;

export type { VideoCharacter, VideoPortrait } from '@/lib/history-merge';

const REFERENCE_ORIGIN_SET: ReadonlySet<string> = new Set(REFERENCE_ORIGINS);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function numberOrZero(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isReferenceOrigin(value: unknown): value is ReferenceOrigin {
    return typeof value === 'string' && REFERENCE_ORIGIN_SET.has(value);
}

function optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

function parsePortraitGroupType(value: unknown): VideoPortraitGroupType {
    return value === 'AIGC' ? 'AIGC' : 'LivenessFace';
}

function readStoredUpdatedAt(): number {
    const raw = localStorage.getItem(UPDATED_AT_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}

function parseCharacters(value: unknown): VideoCharacter[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (
            !isRecord(item) ||
            typeof item.id !== 'string' ||
            typeof item.name !== 'string' ||
            typeof item.url !== 'string'
        ) {
            return [];
        }
        const id = item.id.trim();
        const name = item.name.trim();
        const url = item.url.trim();
        if (!id || !name || !url) return [];
        return [{ id, name, url }];
    });
}

function parsePortraits(value: unknown): VideoPortrait[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (
            !isRecord(item) ||
            typeof item.assetId !== 'string' ||
            typeof item.groupId !== 'string' ||
            typeof item.name !== 'string' ||
            typeof item.thumbUrl !== 'string'
        ) {
            return [];
        }
        const assetId = item.assetId.trim();
        const groupId = item.groupId.trim();
        const name = item.name.trim();
        const thumbUrl = item.thumbUrl.trim();
        if (!assetId || !groupId || !name || !thumbUrl) return [];
        return [{ assetId, groupId, groupType: parsePortraitGroupType(item.groupType), name, thumbUrl }];
    });
}

function parseDeletedIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function parseDeclarations(value: unknown): Record<string, ReferenceDeclaration> {
    if (!isRecord(value)) return {};

    const declarations: Record<string, ReferenceDeclaration> = {};
    for (const [key, item] of Object.entries(value)) {
        if (
            !key ||
            !isRecord(item) ||
            !isReferenceOrigin(item.origin) ||
            typeof item.declaredAt !== 'number' ||
            !Number.isFinite(item.declaredAt)
        ) {
            continue;
        }

        const declaration: ReferenceDeclaration = {
            origin: item.origin,
            declaredAt: item.declaredAt
        };
        const model = optionalString(item.model);
        const assetId = optionalString(item.assetId);
        const groupId = optionalString(item.groupId);
        const authorizationId = optionalString(item.authorizationId);
        if (model) declaration.model = model;
        if (assetId) declaration.assetId = assetId;
        if (groupId) declaration.groupId = groupId;
        if (authorizationId) declaration.authorizationId = authorizationId;
        declarations[key] = declaration;
    }

    return withDeclarations(declarations);
}

function parseHistoryDoc(value: unknown): HistoryDoc | null {
    if (!isRecord(value) || !Array.isArray(value.history)) return null;
    return {
        updatedAt: numberOrZero(value.updatedAt),
        history: value.history as VideoMetadata[],
        characters: parseCharacters(value.characters),
        portraits: parsePortraits(value.portraits),
        declarations: parseDeclarations(value.declarations),
        deletedIds: parseDeletedIds(value.deletedIds)
    };
}

function readStoredCharacters(): { characters: VideoCharacter[]; found: boolean } {
    const raw = localStorage.getItem(CHARACTERS_KEY);
    if (!raw) return { characters: [], found: false };
    return { characters: parseCharacters(JSON.parse(raw) as unknown), found: true };
}

function readStoredDeletedIds(): string[] {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (!raw) return [];
    return parseDeletedIds(JSON.parse(raw) as unknown);
}

function readStoredPortraits(): { portraits: VideoPortrait[]; found: boolean } {
    const raw = localStorage.getItem(PORTRAITS_KEY);
    if (!raw) return { portraits: [], found: false };
    return { portraits: parsePortraits(JSON.parse(raw) as unknown), found: true };
}

function readStoredDeclarations(): { declarations: Record<string, ReferenceDeclaration>; found: boolean } {
    const raw = localStorage.getItem(DECLARATIONS_KEY);
    if (!raw) return { declarations: {}, found: false };
    return { declarations: parseDeclarations(JSON.parse(raw) as unknown), found: true };
}

function readLocalHistory(): HistoryDoc {
    const storedUpdatedAt = readStoredUpdatedAt();
    const storedCharacters = readStoredCharacters();
    const storedPortraits = readStoredPortraits();
    const storedDeclarations = readStoredDeclarations();
    const storedDeletedIds = readStoredDeletedIds();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
        return {
            history: [],
            updatedAt: storedUpdatedAt,
            characters: storedCharacters.characters,
            portraits: storedPortraits.portraits,
            declarations: storedDeclarations.declarations,
            deletedIds: storedDeletedIds
        };
    }

    const parsed = JSON.parse(stored) as unknown;
    if (Array.isArray(parsed)) {
        return {
            history: parsed as VideoMetadata[],
            updatedAt: storedUpdatedAt,
            characters: storedCharacters.characters,
            portraits: storedPortraits.portraits,
            declarations: storedDeclarations.declarations,
            deletedIds: storedDeletedIds
        };
    }

    const doc = parseHistoryDoc(parsed);
    if (doc) {
        return {
            history: doc.history,
            updatedAt: storedUpdatedAt || doc.updatedAt,
            characters: storedCharacters.found ? storedCharacters.characters : doc.characters,
            portraits: storedPortraits.found ? storedPortraits.portraits : doc.portraits,
            declarations: storedDeclarations.found ? storedDeclarations.declarations : doc.declarations,
            deletedIds: storedDeletedIds.length ? storedDeletedIds : doc.deletedIds
        };
    }

    throw new Error('Invalid history data found in localStorage.');
}

function writeLocalHistory(doc: HistoryDoc) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc.history));
    localStorage.setItem(UPDATED_AT_KEY, String(doc.updatedAt));
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify(doc.characters));
    localStorage.setItem(PORTRAITS_KEY, JSON.stringify(doc.portraits));
    localStorage.setItem(DECLARATIONS_KEY, JSON.stringify(withDeclarations(doc.declarations)));
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(doc.deletedIds));
}

/**
 * Video history metadata, persisted to localStorage. Blobs live in IndexedDB
 * (src/lib/db.ts) — this is only the listing the panels render from.
 */
export function useVideoHistory(resolveKey?: () => Promise<string | null>) {
    const [history, setHistory] = React.useState<VideoMetadata[]>([]);
    const [characters, setCharacters] = React.useState<VideoCharacter[]>([]);
    const [portraits, setPortraits] = React.useState<VideoPortrait[]>([]);
    const [declarations, setDeclarations] = React.useState<Record<string, ReferenceDeclaration>>({});
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const [cloudReadyVersion, setCloudReadyVersion] = React.useState(0);

    const historyRef = React.useRef<VideoMetadata[]>([]);
    const charactersRef = React.useRef<VideoCharacter[]>([]);
    const portraitsRef = React.useRef<VideoPortrait[]>([]);
    const declarationsRef = React.useRef<Record<string, ReferenceDeclaration>>({});
    const updatedAtRef = React.useRef(0);
    const deletedIdsRef = React.useRef<string[]>([]);
    const etagRef = React.useRef<string | null>(null);
    const resolveKeyRef = React.useRef(resolveKey);
    const didBootSyncRef = React.useRef(false);
    const cloudReadyRef = React.useRef(false);
    const didObserveLoadedStateRef = React.useRef(false);
    const skipNextCloudPushRef = React.useRef(false);
    const pushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pushQueueRef = React.useRef<Promise<void>>(Promise.resolve());

    historyRef.current = history;
    charactersRef.current = characters;
    portraitsRef.current = portraits;
    declarationsRef.current = declarations;

    React.useEffect(() => {
        resolveKeyRef.current = resolveKey;
    }, [resolveKey]);

    /** The doc as this device currently sees it. */
    const localDoc = React.useCallback(
        (): HistoryDoc => ({
            updatedAt: updatedAtRef.current,
            history: historyRef.current,
            characters: charactersRef.current,
            portraits: portraitsRef.current,
            declarations: declarationsRef.current,
            deletedIds: deletedIdsRef.current
        }),
        []
    );

    const markCloudReady = React.useCallback(() => {
        if (cloudReadyRef.current) return;
        cloudReadyRef.current = true;
        setCloudReadyVersion((version) => version + 1);
    }, []);

    // Load once on mount
    React.useEffect(() => {
        try {
            const doc = readLocalHistory();
            updatedAtRef.current = doc.updatedAt;
            deletedIdsRef.current = doc.deletedIds;
            historyRef.current = doc.history;
            charactersRef.current = doc.characters;
            portraitsRef.current = doc.portraits;
            declarationsRef.current = doc.declarations;
            setHistory(doc.history);
            setCharacters(doc.characters);
            setPortraits(doc.portraits);
            setDeclarations(doc.declarations);
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(UPDATED_AT_KEY);
            localStorage.removeItem(CHARACTERS_KEY);
            localStorage.removeItem(PORTRAITS_KEY);
            localStorage.removeItem(DECLARATIONS_KEY);
            localStorage.removeItem(DELETED_IDS_KEY);
        }
        setIsInitialLoad(false);
    }, []);

    // Persist on change (after the initial load, so an empty first render
    // doesn't wipe stored history)
    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                writeLocalHistory({
                    updatedAt: updatedAtRef.current,
                    history,
                    characters,
                    portraits,
                    declarations,
                    deletedIds: deletedIdsRef.current
                });
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [characters, declarations, history, isInitialLoad, portraits]);

    const applyCloudDoc = React.useCallback((doc: HistoryDoc) => {
        skipNextCloudPushRef.current = true;
        updatedAtRef.current = doc.updatedAt;
        deletedIdsRef.current = doc.deletedIds;
        historyRef.current = doc.history;
        charactersRef.current = doc.characters;
        portraitsRef.current = doc.portraits;
        declarationsRef.current = doc.declarations;
        setHistory(doc.history);
        setCharacters(doc.characters);
        setPortraits(doc.portraits);
        setDeclarations(doc.declarations);
        try {
            writeLocalHistory(doc);
        } catch (e) {
            console.error('Failed to save cloud history to localStorage:', e);
        }
    }, []);

    const pushDocRef = React.useRef<((apiKey: string, doc: HistoryDoc) => Promise<void>) | null>(null);

    /**
     * Someone else wrote the doc since we last read it: merge their version
     * with ours and push the union back once. Adopting the server doc as-is
     * (the old behavior) silently deleted anything created on this device
     * since the last successful push.
     */
    const mergeWithServerState = React.useCallback(
        async (apiKey: string) => {
            const cloud = await fetchCloudState(apiKey);
            if (!cloud) {
                etagRef.current = null;
                return;
            }
            etagRef.current = cloud.etag;
            const cloudDoc = parseHistoryDoc(cloud.doc);
            if (!cloudDoc) {
                console.warn('[history-sync] Ignoring invalid cloud history document.');
                return;
            }
            const merged = mergeDocs(localDoc(), cloudDoc);
            applyCloudDoc(merged);
            if (sameDocContent(merged, cloudDoc)) return;
            try {
                // Single retry — never recurse, a push storm is worse than a
                // late sync.
                await pushDocRef.current?.(apiKey, merged);
            } catch (err) {
                console.warn('[history-sync] Could not push merged history:', err);
            }
        },
        [applyCloudDoc, localDoc]
    );

    const pushDoc = React.useCallback(
        async (apiKey: string, doc: HistoryDoc) => {
            let lastConflict: StateConflictError | null = null;

            for (let attempt = 0; attempt < 3; attempt += 1) {
                let nextDoc = attempt === 0 ? doc : localDoc();
                let nextEtag: string | null = null;

                const cloud = await fetchCloudState(apiKey);
                if (cloud) {
                    nextEtag = cloud.etag;
                    const cloudDoc = parseHistoryDoc(cloud.doc);
                    if (cloudDoc) {
                        nextDoc = mergeDocs(nextDoc, cloudDoc);
                        if (!sameDocContent(nextDoc, localDoc())) {
                            applyCloudDoc(nextDoc);
                        }
                    } else {
                        console.warn('[history-sync] Ignoring invalid cloud history document.');
                    }
                }

                try {
                    etagRef.current = await pushCloudState(
                        // Spread the doc rather than listing its fields: the
                        // explicit list silently dropped `declarations`, and
                        // the next field added would go the same way.
                        { ...nextDoc, declarations: withDeclarations(nextDoc.declarations) },
                        apiKey,
                        nextEtag
                    );
                    return;
                } catch (err) {
                    if (!(err instanceof StateConflictError)) throw err;
                    lastConflict = err;
                }
            }

            throw lastConflict ?? new StateConflictError();
        },
        [applyCloudDoc, localDoc]
    );

    pushDocRef.current = pushDoc;

    const pushDocOrMergeNow = React.useCallback(
        async (apiKey: string, doc: HistoryDoc) => {
            try {
                await pushDoc(apiKey, doc);
            } catch (err) {
                if (err instanceof StateConflictError) {
                    console.warn('[history-sync] Cloud history changed elsewhere; merging.');
                    await mergeWithServerState(apiKey);
                    return;
                }
                console.warn('[history-sync] Could not save cloud history:', err);
            }
        },
        [mergeWithServerState, pushDoc]
    );

    const pushDocOrMerge = React.useCallback(
        (apiKey: string, doc: HistoryDoc) => {
            const run = () => pushDocOrMergeNow(apiKey, doc);
            const queued = pushQueueRef.current.then(run, run);
            pushQueueRef.current = queued.catch(() => undefined);
            return queued;
        },
        [pushDocOrMergeNow]
    );

    // One-shot boot reconciliation. Local state is usable immediately; cloud
    // sync quietly skips itself when there is no key or no media worker.
    React.useEffect(() => {
        if (isInitialLoad || !resolveKey || didBootSyncRef.current) return;
        didBootSyncRef.current = true;

        let cancelled = false;
        void (async () => {
            try {
                if (!(await mediaArchiveEnabled())) {
                    markCloudReady();
                    return;
                }

                const key = await resolveKeyRef.current?.();
                if (!key || cancelled) {
                    markCloudReady();
                    return;
                }

                const cloud = await fetchCloudState(key);
                if (cancelled) return;

                const mine = localDoc();
                if (!cloud) {
                    await pushDocOrMerge(key, mine);
                    markCloudReady();
                    return;
                }

                etagRef.current = cloud.etag;
                const cloudDoc = parseHistoryDoc(cloud.doc);
                if (!cloudDoc) {
                    console.warn('[history-sync] Ignoring invalid cloud history document.');
                    markCloudReady();
                    return;
                }

                // Union both sides rather than picking a winner: a device that
                // was offline still holds videos the cloud has never seen.
                const merged = mergeDocs(mine, cloudDoc);
                applyCloudDoc(merged);
                if (!sameDocContent(merged, cloudDoc)) {
                    await pushDocOrMerge(key, merged);
                }
                markCloudReady();
            } catch (err) {
                console.warn('[history-sync] Could not reconcile cloud history:', err);
                markCloudReady();
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [applyCloudDoc, isInitialLoad, localDoc, markCloudReady, pushDocOrMerge, resolveKey]);

    // Debounced cloud push after user/local mutations. The first loaded state
    // and server-applied states are handled by boot reconciliation, not here.
    React.useEffect(() => {
        if (isInitialLoad || !resolveKey) return;
        if (!cloudReadyRef.current) return;

        if (!didObserveLoadedStateRef.current) {
            didObserveLoadedStateRef.current = true;
            return;
        }

        if (skipNextCloudPushRef.current) {
            skipNextCloudPushRef.current = false;
            return;
        }

        if (pushTimerRef.current) {
            clearTimeout(pushTimerRef.current);
        }
        pushTimerRef.current = setTimeout(() => {
            void (async () => {
                try {
                    if (!(await mediaArchiveEnabled())) return;

                    const key = await resolveKeyRef.current?.();
                    if (!key) return;

                    await pushDocOrMerge(key, localDoc());
                } catch (err) {
                    console.warn('[history-sync] Could not save cloud history:', err);
                }
            })();
        }, SYNC_DEBOUNCE_MS);

        return () => {
            if (pushTimerRef.current) {
                clearTimeout(pushTimerRef.current);
                pushTimerRef.current = null;
            }
        };
    }, [
        characters,
        cloudReadyVersion,
        declarations,
        history,
        isInitialLoad,
        localDoc,
        portraits,
        pushDocOrMerge,
        resolveKey
    ]);

    const mutateDoc = React.useCallback(
        (
            update: (prev: {
                history: VideoMetadata[];
                characters: VideoCharacter[];
                portraits: VideoPortrait[];
                declarations: Record<string, ReferenceDeclaration>;
            }) => {
                history: VideoMetadata[];
                characters: VideoCharacter[];
                portraits: VideoPortrait[];
                declarations: Record<string, ReferenceDeclaration>;
            }
        ) => {
            const next = update({
                history: historyRef.current,
                characters: charactersRef.current,
                portraits: portraitsRef.current,
                declarations: declarationsRef.current
            });
            const nextDeclarations = withDeclarations(next.declarations);
            updatedAtRef.current = Date.now();
            historyRef.current = next.history;
            charactersRef.current = next.characters;
            portraitsRef.current = next.portraits;
            declarationsRef.current = nextDeclarations;
            setHistory(next.history);
            setCharacters(next.characters);
            setPortraits(next.portraits);
            setDeclarations(nextDeclarations);
        },
        []
    );

    /** Records ids as deleted so the removal survives a merge with another device. */
    const tombstone = React.useCallback((ids: string[]) => {
        if (ids.length) deletedIdsRef.current = withTombstones(deletedIdsRef.current, ids);
    }, []);

    const mutateHistory = React.useCallback((update: (prev: VideoMetadata[]) => VideoMetadata[]) => {
        const next = update(historyRef.current);
        updatedAtRef.current = Date.now();
        historyRef.current = next;
        setHistory(next);
    }, []);

    const addItem = React.useCallback(
        (item: VideoMetadata) => {
            // Re-adding an id the user once deleted must clear its tombstone,
            // or the next merge would delete it again.
            deletedIdsRef.current = deletedIdsRef.current.filter((id) => id !== item.id);
            mutateHistory((prev) => [item, ...prev]);
        },
        [mutateHistory]
    );

    const updateItem = React.useCallback(
        (id: string, patch: Partial<VideoMetadata>) => {
            mutateHistory((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
        },
        [mutateHistory]
    );

    const removeItem = React.useCallback(
        (id: string) => {
            tombstone([id]);
            mutateHistory((prev) => prev.filter((item) => item.id !== id));
        },
        [mutateHistory, tombstone]
    );

    const clearAll = React.useCallback(() => {
        tombstone(historyRef.current.map((item) => item.id));
        mutateHistory(() => []);
    }, [mutateHistory, tombstone]);

    const addCharacter = React.useCallback(
        (character: VideoCharacter) => {
            const name = character.name.trim();
            const url = character.url.trim();
            if (!character.id || !name || !url) return;
            mutateDoc((prev) => ({
                history: prev.history,
                portraits: prev.portraits,
                declarations: prev.declarations,
                characters: [
                    ...prev.characters.filter((existing) => existing.id !== character.id),
                    { id: character.id, name, url }
                ]
            }));
        },
        [mutateDoc]
    );

    const removeCharacter = React.useCallback(
        (id: string) => {
            tombstone([id]);
            mutateDoc((prev) => ({
                history: prev.history,
                portraits: prev.portraits,
                declarations: prev.declarations,
                characters: prev.characters.filter((character) => character.id !== id)
            }));
        },
        [mutateDoc, tombstone]
    );

    const addPortrait = React.useCallback(
        (portrait: VideoPortrait) => {
            const assetId = portrait.assetId.trim();
            const groupId = portrait.groupId.trim();
            const groupType = parsePortraitGroupType(portrait.groupType);
            const name = portrait.name.trim();
            const thumbUrl = portrait.thumbUrl.trim();
            if (!assetId || !groupId || !name || !thumbUrl) return;
            mutateDoc((prev) => ({
                history: prev.history,
                characters: prev.characters,
                declarations: prev.declarations,
                portraits: [
                    ...prev.portraits.filter((existing) => existing.assetId !== assetId),
                    { assetId, groupId, groupType, name, thumbUrl }
                ]
            }));
        },
        [mutateDoc]
    );

    const removePortrait = React.useCallback(
        (assetId: string) => {
            tombstone([assetId]);
            mutateDoc((prev) => ({
                history: prev.history,
                characters: prev.characters,
                declarations: prev.declarations,
                portraits: prev.portraits.filter((portrait) => portrait.assetId !== assetId)
            }));
        },
        [mutateDoc, tombstone]
    );

    const setDeclaration = React.useCallback(
        (key: string, declaration: ReferenceDeclaration) => {
            const cleanKey = key.trim();
            if (!cleanKey) return;
            mutateDoc((prev) => ({
                history: prev.history,
                characters: prev.characters,
                portraits: prev.portraits,
                declarations: {
                    ...prev.declarations,
                    [cleanKey]: declaration
                }
            }));
        },
        [mutateDoc]
    );

    return {
        history,
        characters,
        portraits,
        declarations,
        isInitialLoad,
        addItem,
        updateItem,
        removeItem,
        clearAll,
        addCharacter,
        removeCharacter,
        addPortrait,
        removePortrait,
        setDeclaration
    };
}
