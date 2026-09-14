'use client';

import { REFERENCE_ORIGINS, type ReferenceDeclaration, type ReferenceOrigin } from '@/features/assets/reference/origin';
import {
    withTombstones,
    type HistoryDoc,
    type VideoCharacter,
    type VideoPortrait
} from '@/features/generation/history/merge';
import { normalizePortrait, parsePortraits } from '@/features/generation/history/portraits';
import { businessStatus, businessStorage, flushBusiness } from '@/features/persistence/store';
import type { VideoMetadata } from '@/shared/contracts/video';
import * as React from 'react';

/** Kept under the historical name so existing users' history survives. */
const STORAGE_KEY = 'soraVideoHistory';
const UPDATED_AT_KEY = 'soraVideoHistoryUpdatedAt';
const CHARACTERS_KEY = 'soraVideoCharacters';
const PORTRAITS_KEY = 'soraVideoPortraits';
const DECLARATIONS_KEY = 'soraReferenceDeclarations';
const DELETED_IDS_KEY = 'soraVideoDeletedIds';
export type { VideoCharacter, VideoPortrait } from '@/features/generation/history/merge';

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

function readStoredUpdatedAt(): number {
    const raw = businessStorage.getItem(UPDATED_AT_KEY);
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
        const previewUrl = optionalString(item.previewUrl);
        return [{ id, name, url, ...(previewUrl ? { previewUrl } : {}) }];
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
        const note = optionalString(item.note);
        if (model) declaration.model = model;
        if (assetId) declaration.assetId = assetId;
        if (groupId) declaration.groupId = groupId;
        if (authorizationId) declaration.authorizationId = authorizationId;
        if (note) declaration.note = note;
        declarations[key] = declaration;
    }

    return declarations;
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
    const raw = businessStorage.getItem(CHARACTERS_KEY);
    if (!raw) return { characters: [], found: false };
    return { characters: parseCharacters(JSON.parse(raw) as unknown), found: true };
}

function readStoredDeletedIds(): string[] {
    const raw = businessStorage.getItem(DELETED_IDS_KEY);
    if (!raw) return [];
    return parseDeletedIds(JSON.parse(raw) as unknown);
}

function readStoredPortraits(): { portraits: VideoPortrait[]; found: boolean } {
    const raw = businessStorage.getItem(PORTRAITS_KEY);
    if (!raw) return { portraits: [], found: false };
    return { portraits: parsePortraits(JSON.parse(raw) as unknown), found: true };
}

function readStoredDeclarations(): { declarations: Record<string, ReferenceDeclaration>; found: boolean } {
    const raw = businessStorage.getItem(DECLARATIONS_KEY);
    if (!raw) return { declarations: {}, found: false };
    return { declarations: parseDeclarations(JSON.parse(raw) as unknown), found: true };
}

function readLocalHistory(): HistoryDoc {
    const storedUpdatedAt = readStoredUpdatedAt();
    const storedCharacters = readStoredCharacters();
    const storedPortraits = readStoredPortraits();
    const storedDeclarations = readStoredDeclarations();
    const storedDeletedIds = readStoredDeletedIds();
    const stored = businessStorage.getItem(STORAGE_KEY);
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

    throw new Error('Invalid history data found in businessStorage.');
}

function businessStorageReady() {
    return businessStatus().ready;
}

function writeLocalHistory(doc: HistoryDoc) {
    if (!businessStorageReady()) return;
    businessStorage.setItem(STORAGE_KEY, JSON.stringify(doc.history));
    businessStorage.setItem(UPDATED_AT_KEY, String(doc.updatedAt));
    businessStorage.setItem(CHARACTERS_KEY, JSON.stringify(doc.characters));
    businessStorage.setItem(PORTRAITS_KEY, JSON.stringify(doc.portraits));
    businessStorage.setItem(DECLARATIONS_KEY, JSON.stringify(doc.declarations));
    businessStorage.setItem(DELETED_IDS_KEY, JSON.stringify(doc.deletedIds));
}

type VideoHistoryOptions = {
    onPersistenceError?: (message: string) => void;
};

function persistenceErrorMessage(error: unknown): string {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        return 'Video finished, but Studio could not save it to History because browser storage is full. Download or archive it before refreshing.';
    }
    return 'Video finished, but Studio could not save it to History in this browser. Download or archive it before refreshing.';
}

/**
 * Video history metadata, persisted to businessStorage. Blobs live in IndexedDB
 * (src/lib/db.ts) — this is only the listing the panels render from.
 */
export function useVideoHistory(_resolveKey?: () => Promise<string | null>, options: VideoHistoryOptions = {}) {
    const [history, setHistory] = React.useState<VideoMetadata[]>([]);
    const [characters, setCharacters] = React.useState<VideoCharacter[]>([]);
    const [portraits, setPortraits] = React.useState<VideoPortrait[]>([]);
    const [declarations, setDeclarations] = React.useState<Record<string, ReferenceDeclaration>>({});
    const [deletedIds, setDeletedIds] = React.useState<string[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);

    const historyRef = React.useRef<VideoMetadata[]>([]);
    const charactersRef = React.useRef<VideoCharacter[]>([]);
    const portraitsRef = React.useRef<VideoPortrait[]>([]);
    const declarationsRef = React.useRef<Record<string, ReferenceDeclaration>>({});
    const updatedAtRef = React.useRef(0);
    const deletedIdsRef = React.useRef<string[]>([]);
    const onPersistenceErrorRef = React.useRef(options.onPersistenceError);

    historyRef.current = history;
    charactersRef.current = characters;
    portraitsRef.current = portraits;
    declarationsRef.current = declarations;

    React.useEffect(() => {
        onPersistenceErrorRef.current = options.onPersistenceError;
    }, [options.onPersistenceError]);

    const reportPersistenceError = React.useCallback((error: unknown) => {
        console.error('Failed to save history to localStorage:', error);
        onPersistenceErrorRef.current?.(persistenceErrorMessage(error));
    }, []);

    // Load the PostgreSQL-hydrated snapshot on mount
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
            setDeletedIds(doc.deletedIds);
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            if (businessStorageReady()) {
                businessStorage.removeItem(STORAGE_KEY);
                businessStorage.removeItem(UPDATED_AT_KEY);
                businessStorage.removeItem(CHARACTERS_KEY);
                businessStorage.removeItem(PORTRAITS_KEY);
                businessStorage.removeItem(DECLARATIONS_KEY);
                businessStorage.removeItem(DELETED_IDS_KEY);
            }
        }
        setIsInitialLoad(false);
    }, []);

    // Persist on change (after the initial load, so an empty first render
    // doesn't wipe stored history)
    React.useEffect(() => {
        if (!isInitialLoad && businessStorageReady()) {
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
                reportPersistenceError(e);
            }
        }
    }, [characters, declarations, deletedIds, history, isInitialLoad, portraits, reportPersistenceError]);

    const syncCloudNow = React.useCallback(() => flushBusiness(), []);

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
            const nextDeclarations = next.declarations;
            updatedAtRef.current = Date.now();
            historyRef.current = next.history;
            charactersRef.current = next.characters;
            portraitsRef.current = next.portraits;
            declarationsRef.current = nextDeclarations;
            try {
                writeLocalHistory({
                    updatedAt: updatedAtRef.current,
                    history: next.history,
                    characters: next.characters,
                    portraits: next.portraits,
                    declarations: nextDeclarations,
                    deletedIds: deletedIdsRef.current
                });
            } catch (e) {
                reportPersistenceError(e);
            }
            setHistory(next.history);
            setCharacters(next.characters);
            setPortraits(next.portraits);
            setDeclarations(nextDeclarations);
        },
        [reportPersistenceError]
    );

    /** Records ids as deleted so the removal survives a merge with another device. */
    const tombstone = React.useCallback((ids: string[]) => {
        if (!ids.length) return;
        const next = withTombstones(deletedIdsRef.current, ids);
        deletedIdsRef.current = next;
        setDeletedIds(next);
    }, []);

    const mutateHistory = React.useCallback(
        (update: (prev: VideoMetadata[]) => VideoMetadata[]) => {
            const next = update(historyRef.current);
            updatedAtRef.current = Date.now();
            historyRef.current = next;
            try {
                writeLocalHistory({
                    updatedAt: updatedAtRef.current,
                    history: next,
                    characters: charactersRef.current,
                    portraits: portraitsRef.current,
                    declarations: declarationsRef.current,
                    deletedIds: deletedIdsRef.current
                });
            } catch (e) {
                reportPersistenceError(e);
            }
            setHistory(next);
        },
        [reportPersistenceError]
    );

    const addItem = React.useCallback(
        (item: VideoMetadata) => {
            // Re-adding an id the user once deleted must clear its tombstone,
            // or the next merge would delete it again.
            deletedIdsRef.current = deletedIdsRef.current.filter((id) => id !== item.id);
            setDeletedIds(deletedIdsRef.current);
            const now = Date.now();
            mutateHistory((prev) => [{ ...item, updatedAt: item.updatedAt ?? now }, ...prev]);
        },
        [mutateHistory]
    );

    const replaceItem = React.useCallback(
        (oldId: string, item: VideoMetadata) => {
            tombstone([oldId]);
            // Re-adding an id the user once deleted must clear its tombstone,
            // or the next merge would delete it again.
            deletedIdsRef.current = deletedIdsRef.current.filter((id) => id !== item.id);
            setDeletedIds(deletedIdsRef.current);
            const now = Date.now();
            mutateHistory((prev) => [
                { ...item, updatedAt: item.updatedAt ?? now },
                ...prev.filter((existing) => existing.id !== oldId && existing.id !== item.id)
            ]);
        },
        [mutateHistory, tombstone]
    );

    const updateItem = React.useCallback(
        (id: string, patch: Partial<VideoMetadata>) => {
            const now = Date.now();
            mutateHistory((prev) =>
                prev.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: patch.updatedAt ?? now } : item))
            );
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

    const syncNow = React.useCallback(() => flushBusiness(), []);

    const addCharacter = React.useCallback(
        (character: VideoCharacter) => {
            const name = character.name.trim();
            const url = character.url.trim();
            const previewUrl = character.previewUrl?.trim();
            if (!character.id || !name || !url) return;
            mutateDoc((prev) => ({
                history: prev.history,
                portraits: prev.portraits,
                declarations: prev.declarations,
                characters: [
                    ...prev.characters.filter((existing) => existing.id !== character.id),
                    { id: character.id, name, url, ...(previewUrl ? { previewUrl } : {}) }
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
            const normalized = normalizePortrait(portrait);
            if (!normalized) return;
            mutateDoc((prev) => ({
                history: prev.history,
                characters: prev.characters,
                declarations: prev.declarations,
                portraits: [...prev.portraits.filter((existing) => existing.assetId !== normalized.assetId), normalized]
            }));
        },
        [mutateDoc]
    );

    const findPortraitByUrl = React.useCallback((url: string) => {
        const normalizedUrl = url.trim();
        return portraitsRef.current.reduce<VideoPortrait | undefined>((latest, portrait) => {
            if (portrait.thumbUrl !== normalizedUrl) return latest;
            return !latest || portrait.updatedAt > latest.updatedAt ? portrait : latest;
        }, undefined);
    }, []);

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
        deletedIds,
        isInitialLoad,
        addItem,
        replaceItem,
        updateItem,
        removeItem,
        clearAll,
        syncNow,
        syncCloudNow,
        addCharacter,
        removeCharacter,
        addPortrait,
        findPortraitByUrl,
        removePortrait,
        setDeclaration
    };
}
