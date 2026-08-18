/**
 * Merge rules for the cloud-synced studio document.
 *
 * Split out of use-video-history because this is the data-safety core: it
 * decides what survives when two devices (or a stale tab) disagree.
 */

import type { VideoMetadata } from '@/types/video';

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

export interface HistoryDoc {
    updatedAt: number;
    history: VideoMetadata[];
    characters: VideoCharacter[];
    portraits: VideoPortrait[];
    /**
     * Ids removed by the user (videos, characters, portraits — distinct id
     * spaces, one list). Without these, merging two devices would resurrect
     * everything either of them deleted.
     */
    deletedIds: string[];
}

/** Tombstones are just id strings; keep the newest ones so deletes propagate. */
const MAX_TOMBSTONES = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function withTombstones(existing: string[], ids: string[]): string[] {
    const next = existing.filter((id) => !ids.includes(id)).concat(ids);
    return next.length > MAX_TOMBSTONES ? next.slice(next.length - MAX_TOMBSTONES) : next;
}

/** Terminal beats in-flight; an archived copy beats a local-only one. */
function historyRank(item: VideoMetadata): number {
    const terminal = item.status === 'completed' || item.status === 'failed' ? 2 : 0;
    return terminal + (item.storedUrl ? 1 : 0);
}

/**
 * Entry-level merge of two devices' docs.
 *
 * Document-level last-write-wins destroyed data: a device pushing with a
 * stale ETag adopted the server doc wholesale, discarding whatever it had
 * just created. Union by id instead — minus anything either side tombstoned —
 * and let the more advanced version of a shared id win (local breaks ties,
 * since that is what the user is looking at).
 */
export function mergeDocs(local: HistoryDoc, remote: HistoryDoc): HistoryDoc {
    const deletedIds = withTombstones(remote.deletedIds, local.deletedIds);
    const tombstoned = new Set(deletedIds);

    const byId = new Map<string, VideoMetadata>();
    for (const item of [...remote.history, ...local.history]) {
        if (!isRecord(item) || typeof item.id !== 'string' || tombstoned.has(item.id)) continue;
        const existing = byId.get(item.id);
        if (!existing || historyRank(item) >= historyRank(existing)) byId.set(item.id, item);
    }

    const characterById = new Map<string, VideoCharacter>();
    for (const character of [...remote.characters, ...local.characters]) {
        if (!tombstoned.has(character.id)) characterById.set(character.id, character);
    }

    const portraitByAssetId = new Map<string, VideoPortrait>();
    for (const portrait of [...remote.portraits, ...local.portraits]) {
        if (!tombstoned.has(portrait.assetId)) portraitByAssetId.set(portrait.assetId, portrait);
    }

    return {
        updatedAt: Math.max(local.updatedAt, remote.updatedAt),
        history: Array.from(byId.values()).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
        characters: Array.from(characterById.values()),
        portraits: Array.from(portraitByAssetId.values()),
        deletedIds
    };
}

export function sameDocContent(a: HistoryDoc, b: HistoryDoc): boolean {
    return (
        JSON.stringify([a.history, a.characters, a.portraits, a.deletedIds]) ===
        JSON.stringify([b.history, b.characters, b.portraits, b.deletedIds])
    );
}
