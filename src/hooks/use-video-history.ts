'use client';

import { StateConflictError } from '@/lib/errors';
import { fetchCloudState, mediaArchiveEnabled, pushCloudState } from '@/lib/media-archive';
import type { VideoMetadata } from '@/types/video';
import * as React from 'react';

/** Kept under the historical name so existing users' history survives. */
const STORAGE_KEY = 'soraVideoHistory';
const UPDATED_AT_KEY = 'soraVideoHistoryUpdatedAt';
const CHARACTERS_KEY = 'soraVideoCharacters';
const SYNC_DEBOUNCE_MS = 3000;

export type VideoCharacter = {
    id: string;
    name: string;
    url: string;
};

interface HistoryDoc {
    updatedAt: number;
    history: VideoMetadata[];
    characters: VideoCharacter[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function numberOrZero(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

function parseHistoryDoc(value: unknown): HistoryDoc | null {
    if (!isRecord(value) || !Array.isArray(value.history)) return null;
    return {
        updatedAt: numberOrZero(value.updatedAt),
        history: value.history as VideoMetadata[],
        characters: parseCharacters(value.characters)
    };
}

function readStoredCharacters(): { characters: VideoCharacter[]; found: boolean } {
    const raw = localStorage.getItem(CHARACTERS_KEY);
    if (!raw) return { characters: [], found: false };
    return { characters: parseCharacters(JSON.parse(raw) as unknown), found: true };
}

function readLocalHistory(): HistoryDoc {
    const storedUpdatedAt = readStoredUpdatedAt();
    const storedCharacters = readStoredCharacters();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
        return { history: [], updatedAt: storedUpdatedAt, characters: storedCharacters.characters };
    }

    const parsed = JSON.parse(stored) as unknown;
    if (Array.isArray(parsed)) {
        return {
            history: parsed as VideoMetadata[],
            updatedAt: storedUpdatedAt,
            characters: storedCharacters.characters
        };
    }

    const doc = parseHistoryDoc(parsed);
    if (doc) {
        return {
            history: doc.history,
            updatedAt: storedUpdatedAt || doc.updatedAt,
            characters: storedCharacters.found ? storedCharacters.characters : doc.characters
        };
    }

    throw new Error('Invalid history data found in localStorage.');
}

function writeLocalHistory(doc: HistoryDoc) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc.history));
    localStorage.setItem(UPDATED_AT_KEY, String(doc.updatedAt));
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify(doc.characters));
}

/**
 * Video history metadata, persisted to localStorage. Blobs live in IndexedDB
 * (src/lib/db.ts) — this is only the listing the panels render from.
 */
export function useVideoHistory(resolveKey?: () => Promise<string | null>) {
    const [history, setHistory] = React.useState<VideoMetadata[]>([]);
    const [characters, setCharacters] = React.useState<VideoCharacter[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);

    const historyRef = React.useRef<VideoMetadata[]>([]);
    const charactersRef = React.useRef<VideoCharacter[]>([]);
    const updatedAtRef = React.useRef(0);
    const etagRef = React.useRef<string | null>(null);
    const resolveKeyRef = React.useRef(resolveKey);
    const didBootSyncRef = React.useRef(false);
    const didObserveLoadedStateRef = React.useRef(false);
    const skipNextCloudPushRef = React.useRef(false);
    const pushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    historyRef.current = history;
    charactersRef.current = characters;

    React.useEffect(() => {
        resolveKeyRef.current = resolveKey;
    }, [resolveKey]);

    // Load once on mount
    React.useEffect(() => {
        try {
            const doc = readLocalHistory();
            updatedAtRef.current = doc.updatedAt;
            historyRef.current = doc.history;
            charactersRef.current = doc.characters;
            setHistory(doc.history);
            setCharacters(doc.characters);
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(UPDATED_AT_KEY);
            localStorage.removeItem(CHARACTERS_KEY);
        }
        setIsInitialLoad(false);
    }, []);

    // Persist on change (after the initial load, so an empty first render
    // doesn't wipe stored history)
    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                writeLocalHistory({ updatedAt: updatedAtRef.current, history, characters });
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [characters, history, isInitialLoad]);

    const applyCloudDoc = React.useCallback((doc: HistoryDoc) => {
        skipNextCloudPushRef.current = true;
        updatedAtRef.current = doc.updatedAt;
        historyRef.current = doc.history;
        charactersRef.current = doc.characters;
        setHistory(doc.history);
        setCharacters(doc.characters);
        try {
            writeLocalHistory(doc);
        } catch (e) {
            console.error('Failed to save cloud history to localStorage:', e);
        }
    }, []);

    const adoptServerState = React.useCallback(
        async (apiKey: string) => {
            const cloud = await fetchCloudState(apiKey);
            if (!cloud) {
                etagRef.current = null;
                return;
            }
            etagRef.current = cloud.etag;
            const doc = parseHistoryDoc(cloud.doc);
            if (!doc) {
                console.warn('[history-sync] Ignoring invalid cloud history document.');
                return;
            }
            applyCloudDoc(doc);
        },
        [applyCloudDoc]
    );

    const pushDoc = React.useCallback(async (apiKey: string, doc: HistoryDoc) => {
        etagRef.current = await pushCloudState(
            {
                updatedAt: doc.updatedAt,
                history: doc.history,
                characters: doc.characters
            },
            apiKey,
            etagRef.current
        );
    }, []);

    const pushDocOrAdoptServer = React.useCallback(
        async (apiKey: string, doc: HistoryDoc) => {
            try {
                await pushDoc(apiKey, doc);
            } catch (err) {
                if (err instanceof StateConflictError) {
                    console.warn('[history-sync] Cloud history changed on another device; using server state.');
                    await adoptServerState(apiKey);
                    return;
                }
                console.warn('[history-sync] Could not save cloud history:', err);
            }
        },
        [adoptServerState, pushDoc]
    );

    // One-shot boot reconciliation. Local state is usable immediately; cloud
    // sync quietly skips itself when there is no key or no media worker.
    React.useEffect(() => {
        if (isInitialLoad || !resolveKey || didBootSyncRef.current) return;
        didBootSyncRef.current = true;

        let cancelled = false;
        void (async () => {
            try {
                if (!(await mediaArchiveEnabled())) return;

                const key = await resolveKeyRef.current?.();
                if (!key || cancelled) return;

                const cloud = await fetchCloudState(key);
                if (cancelled) return;

                const localDoc = {
                    updatedAt: updatedAtRef.current,
                    history: historyRef.current,
                    characters: charactersRef.current
                };
                if (!cloud) {
                    await pushDocOrAdoptServer(key, localDoc);
                    return;
                }

                etagRef.current = cloud.etag;
                const cloudDoc = parseHistoryDoc(cloud.doc);
                if (!cloudDoc) {
                    console.warn('[history-sync] Ignoring invalid cloud history document.');
                    return;
                }

                if (cloudDoc.updatedAt > localDoc.updatedAt) {
                    applyCloudDoc(cloudDoc);
                    return;
                }

                if (localDoc.updatedAt > cloudDoc.updatedAt) {
                    await pushDocOrAdoptServer(key, localDoc);
                }
            } catch (err) {
                console.warn('[history-sync] Could not reconcile cloud history:', err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [applyCloudDoc, isInitialLoad, pushDocOrAdoptServer, resolveKey]);

    // Debounced cloud push after user/local mutations. The first loaded state
    // and server-applied states are handled by boot reconciliation, not here.
    React.useEffect(() => {
        if (isInitialLoad || !resolveKey) return;

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

                    await pushDocOrAdoptServer(key, {
                        updatedAt: updatedAtRef.current,
                        history: historyRef.current,
                        characters: charactersRef.current
                    });
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
    }, [characters, history, isInitialLoad, pushDocOrAdoptServer, resolveKey]);

    const mutateDoc = React.useCallback(
        (update: (prev: { history: VideoMetadata[]; characters: VideoCharacter[] }) => {
            history: VideoMetadata[];
            characters: VideoCharacter[];
        }) => {
            const next = update({ history: historyRef.current, characters: charactersRef.current });
            updatedAtRef.current = Date.now();
            historyRef.current = next.history;
            charactersRef.current = next.characters;
            setHistory(next.history);
            setCharacters(next.characters);
        },
        []
    );

    const mutateHistory = React.useCallback((update: (prev: VideoMetadata[]) => VideoMetadata[]) => {
        const next = update(historyRef.current);
        updatedAtRef.current = Date.now();
        historyRef.current = next;
        setHistory(next);
    }, []);

    const addItem = React.useCallback((item: VideoMetadata) => {
        mutateHistory((prev) => [item, ...prev]);
    }, [mutateHistory]);

    const updateItem = React.useCallback((id: string, patch: Partial<VideoMetadata>) => {
        mutateHistory((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    }, [mutateHistory]);

    const removeItem = React.useCallback((id: string) => {
        mutateHistory((prev) => prev.filter((item) => item.id !== id));
    }, [mutateHistory]);

    const clearAll = React.useCallback(() => {
        mutateHistory(() => []);
    }, [mutateHistory]);

    const addCharacter = React.useCallback(
        (character: VideoCharacter) => {
            const name = character.name.trim();
            const url = character.url.trim();
            if (!character.id || !name || !url) return;
            mutateDoc((prev) => ({
                history: prev.history,
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
            mutateDoc((prev) => ({
                history: prev.history,
                characters: prev.characters.filter((character) => character.id !== id)
            }));
        },
        [mutateDoc]
    );

    return {
        history,
        characters,
        isInitialLoad,
        addItem,
        updateItem,
        removeItem,
        clearAll,
        addCharacter,
        removeCharacter
    };
}
