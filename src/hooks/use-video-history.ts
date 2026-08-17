'use client';

import { StateConflictError } from '@/lib/errors';
import { fetchCloudState, mediaArchiveEnabled, pushCloudState } from '@/lib/media-archive';
import type { VideoMetadata } from '@/types/video';
import * as React from 'react';

/** Kept under the historical name so existing users' history survives. */
const STORAGE_KEY = 'soraVideoHistory';
const UPDATED_AT_KEY = 'soraVideoHistoryUpdatedAt';
const CHARACTERS_KEY = 'soraVideoCharacters';
const PORTRAITS_KEY = 'soraVideoPortraits';
const SYNC_DEBOUNCE_MS = 3000;

export type VideoCharacter = {
    id: string;
    name: string;
    url: string;
};

export type VideoPortrait = {
    assetId: string;
    groupId: string;
    name: string;
    thumbUrl: string;
};

interface HistoryDoc {
    updatedAt: number;
    history: VideoMetadata[];
    characters: VideoCharacter[];
    portraits: VideoPortrait[];
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
        return [{ assetId, groupId, name, thumbUrl }];
    });
}

function parseHistoryDoc(value: unknown): HistoryDoc | null {
    if (!isRecord(value) || !Array.isArray(value.history)) return null;
    return {
        updatedAt: numberOrZero(value.updatedAt),
        history: value.history as VideoMetadata[],
        characters: parseCharacters(value.characters),
        portraits: parsePortraits(value.portraits)
    };
}

function readStoredCharacters(): { characters: VideoCharacter[]; found: boolean } {
    const raw = localStorage.getItem(CHARACTERS_KEY);
    if (!raw) return { characters: [], found: false };
    return { characters: parseCharacters(JSON.parse(raw) as unknown), found: true };
}

function readStoredPortraits(): { portraits: VideoPortrait[]; found: boolean } {
    const raw = localStorage.getItem(PORTRAITS_KEY);
    if (!raw) return { portraits: [], found: false };
    return { portraits: parsePortraits(JSON.parse(raw) as unknown), found: true };
}

function readLocalHistory(): HistoryDoc {
    const storedUpdatedAt = readStoredUpdatedAt();
    const storedCharacters = readStoredCharacters();
    const storedPortraits = readStoredPortraits();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
        return {
            history: [],
            updatedAt: storedUpdatedAt,
            characters: storedCharacters.characters,
            portraits: storedPortraits.portraits
        };
    }

    const parsed = JSON.parse(stored) as unknown;
    if (Array.isArray(parsed)) {
        return {
            history: parsed as VideoMetadata[],
            updatedAt: storedUpdatedAt,
            characters: storedCharacters.characters,
            portraits: storedPortraits.portraits
        };
    }

    const doc = parseHistoryDoc(parsed);
    if (doc) {
        return {
            history: doc.history,
            updatedAt: storedUpdatedAt || doc.updatedAt,
            characters: storedCharacters.found ? storedCharacters.characters : doc.characters,
            portraits: storedPortraits.found ? storedPortraits.portraits : doc.portraits
        };
    }

    throw new Error('Invalid history data found in localStorage.');
}

function writeLocalHistory(doc: HistoryDoc) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc.history));
    localStorage.setItem(UPDATED_AT_KEY, String(doc.updatedAt));
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify(doc.characters));
    localStorage.setItem(PORTRAITS_KEY, JSON.stringify(doc.portraits));
}

/**
 * Video history metadata, persisted to localStorage. Blobs live in IndexedDB
 * (src/lib/db.ts) — this is only the listing the panels render from.
 */
export function useVideoHistory(resolveKey?: () => Promise<string | null>) {
    const [history, setHistory] = React.useState<VideoMetadata[]>([]);
    const [characters, setCharacters] = React.useState<VideoCharacter[]>([]);
    const [portraits, setPortraits] = React.useState<VideoPortrait[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);

    const historyRef = React.useRef<VideoMetadata[]>([]);
    const charactersRef = React.useRef<VideoCharacter[]>([]);
    const portraitsRef = React.useRef<VideoPortrait[]>([]);
    const updatedAtRef = React.useRef(0);
    const etagRef = React.useRef<string | null>(null);
    const resolveKeyRef = React.useRef(resolveKey);
    const didBootSyncRef = React.useRef(false);
    const didObserveLoadedStateRef = React.useRef(false);
    const skipNextCloudPushRef = React.useRef(false);
    const pushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    historyRef.current = history;
    charactersRef.current = characters;
    portraitsRef.current = portraits;

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
            portraitsRef.current = doc.portraits;
            setHistory(doc.history);
            setCharacters(doc.characters);
            setPortraits(doc.portraits);
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(UPDATED_AT_KEY);
            localStorage.removeItem(CHARACTERS_KEY);
            localStorage.removeItem(PORTRAITS_KEY);
        }
        setIsInitialLoad(false);
    }, []);

    // Persist on change (after the initial load, so an empty first render
    // doesn't wipe stored history)
    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                writeLocalHistory({ updatedAt: updatedAtRef.current, history, characters, portraits });
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [characters, history, isInitialLoad, portraits]);

    const applyCloudDoc = React.useCallback((doc: HistoryDoc) => {
        skipNextCloudPushRef.current = true;
        updatedAtRef.current = doc.updatedAt;
        historyRef.current = doc.history;
        charactersRef.current = doc.characters;
        portraitsRef.current = doc.portraits;
        setHistory(doc.history);
        setCharacters(doc.characters);
        setPortraits(doc.portraits);
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
                characters: doc.characters,
                portraits: doc.portraits
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
                    characters: charactersRef.current,
                    portraits: portraitsRef.current
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
                        characters: charactersRef.current,
                        portraits: portraitsRef.current
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
    }, [characters, history, isInitialLoad, portraits, pushDocOrAdoptServer, resolveKey]);

    const mutateDoc = React.useCallback(
        (update: (prev: {
            history: VideoMetadata[];
            characters: VideoCharacter[];
            portraits: VideoPortrait[];
        }) => {
            history: VideoMetadata[];
            characters: VideoCharacter[];
            portraits: VideoPortrait[];
        }) => {
            const next = update({
                history: historyRef.current,
                characters: charactersRef.current,
                portraits: portraitsRef.current
            });
            updatedAtRef.current = Date.now();
            historyRef.current = next.history;
            charactersRef.current = next.characters;
            portraitsRef.current = next.portraits;
            setHistory(next.history);
            setCharacters(next.characters);
            setPortraits(next.portraits);
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
                portraits: prev.portraits,
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
                portraits: prev.portraits,
                characters: prev.characters.filter((character) => character.id !== id)
            }));
        },
        [mutateDoc]
    );

    const addPortrait = React.useCallback(
        (portrait: VideoPortrait) => {
            const assetId = portrait.assetId.trim();
            const groupId = portrait.groupId.trim();
            const name = portrait.name.trim();
            const thumbUrl = portrait.thumbUrl.trim();
            if (!assetId || !groupId || !name || !thumbUrl) return;
            mutateDoc((prev) => ({
                history: prev.history,
                characters: prev.characters,
                portraits: [
                    ...prev.portraits.filter((existing) => existing.assetId !== assetId),
                    { assetId, groupId, name, thumbUrl }
                ]
            }));
        },
        [mutateDoc]
    );

    const removePortrait = React.useCallback(
        (assetId: string) => {
            mutateDoc((prev) => ({
                history: prev.history,
                characters: prev.characters,
                portraits: prev.portraits.filter((portrait) => portrait.assetId !== assetId)
            }));
        },
        [mutateDoc]
    );

    return {
        history,
        characters,
        portraits,
        isInitialLoad,
        addItem,
        updateItem,
        removeItem,
        clearAll,
        addCharacter,
        removeCharacter,
        addPortrait,
        removePortrait
    };
}
