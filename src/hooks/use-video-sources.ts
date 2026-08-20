'use client';

import { db, type VideoRecord } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';

interface ObjectUrls {
    video?: string;
    thumb?: string;
}

/**
 * Resolves a playback/thumbnail source per video id.
 *
 * Priority: local blob (object URL from IndexedDB) → remote URL (permanent R2
 * copy or the provider's 24h CDN link, whichever a caller registered).
 *
 * Object URLs are created once per IndexedDB record inside an effect — never
 * during render — and revoked when the record disappears or on unmount. The
 * previous implementation minted a fresh unreleased URL on every render of
 * every history tile, which leaked the blobs it pointed at.
 */
export function useVideoSources() {
    const allDbVideos = useLiveQuery<VideoRecord[] | undefined>(() => db.videos.toArray(), []);

    // Remote (http) sources need no lifecycle management.
    const [remoteSources, setRemoteSources] = React.useState<Map<string, string>>(new Map());

    const objectUrlsRef = React.useRef<Map<string, ObjectUrls>>(new Map());
    // Object URLs live in a ref (revocation needs the previous value); bump a
    // counter so consumers re-render when the map changes.
    const [, setObjectUrlVersion] = React.useState(0);

    React.useEffect(() => {
        if (!allDbVideos) return;

        const urls = objectUrlsRef.current;
        const liveIds = new Set(allDbVideos.map((rec) => rec.id));
        let changed = false;

        for (const [id, entry] of urls) {
            if (!liveIds.has(id)) {
                if (entry.video) URL.revokeObjectURL(entry.video);
                if (entry.thumb) URL.revokeObjectURL(entry.thumb);
                urls.delete(id);
                changed = true;
            }
        }

        for (const rec of allDbVideos) {
            const entry = urls.get(rec.id) ?? {};
            if (rec.blob && !entry.video) {
                entry.video = URL.createObjectURL(rec.blob);
                changed = true;
            } else if (!rec.blob && entry.video) {
                URL.revokeObjectURL(entry.video);
                entry.video = undefined;
                changed = true;
            }

            if (rec.thumbnail && !entry.thumb) {
                entry.thumb = URL.createObjectURL(rec.thumbnail);
                changed = true;
            } else if (!rec.thumbnail && entry.thumb) {
                URL.revokeObjectURL(entry.thumb);
                entry.thumb = undefined;
                changed = true;
            }

            if (entry.video || entry.thumb) {
                urls.set(rec.id, entry);
            } else if (urls.has(rec.id)) {
                urls.delete(rec.id);
                changed = true;
            }
        }

        if (changed) setObjectUrlVersion((v) => v + 1);
    }, [allDbVideos]);

    // Revoke everything on unmount.
    React.useEffect(() => {
        const urls = objectUrlsRef.current;
        return () => {
            for (const [, entry] of urls) {
                if (entry.video) URL.revokeObjectURL(entry.video);
                if (entry.thumb) URL.revokeObjectURL(entry.thumb);
            }
            urls.clear();
        };
    }, []);

    /** Registers a remote (CDN / R2) source for an id. */
    const setRemoteSource = React.useCallback((id: string, url: string) => {
        setRemoteSources((prev) => {
            // Re-registering the same URL would hand consumers a new map and
            // reload any <video> already playing from it.
            if (prev.get(id) === url) return prev;
            return new Map(prev).set(id, url);
        });
    }, []);

    const removeSource = React.useCallback((id: string) => {
        const entry = objectUrlsRef.current.get(id);
        if (entry) {
            if (entry.video) URL.revokeObjectURL(entry.video);
            if (entry.thumb) URL.revokeObjectURL(entry.thumb);
            objectUrlsRef.current.delete(id);
            setObjectUrlVersion((v) => v + 1);
        }
        setRemoteSources((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const clearAllSources = React.useCallback(() => {
        for (const [, entry] of objectUrlsRef.current) {
            if (entry.video) URL.revokeObjectURL(entry.video);
            if (entry.thumb) URL.revokeObjectURL(entry.thumb);
        }
        objectUrlsRef.current.clear();
        setObjectUrlVersion((v) => v + 1);
        setRemoteSources(new Map());
    }, []);

    const getVideoSrc = React.useCallback(
        (id: string): string | undefined => {
            return objectUrlsRef.current.get(id)?.video ?? remoteSources.get(id);
        },
        [remoteSources]
    );

    const getThumbnailSrc = React.useCallback((id: string): string | undefined => {
        // Thumbnails are captured client-side from the downloaded blob and
        // stored in IndexedDB — the TokenHub gateway has no thumbnail variant.
        return objectUrlsRef.current.get(id)?.thumb;
    }, []);

    const hasLocalCopy = React.useCallback(
        (id: string): boolean => {
            return allDbVideos?.some((rec) => rec.id === id && Boolean(rec.blob)) ?? false;
        },
        [allDbVideos]
    );

    const hasSource = React.useCallback(
        (id: string): boolean => {
            return Boolean(objectUrlsRef.current.get(id)?.video) || remoteSources.has(id);
        },
        [remoteSources]
    );

    return { getVideoSrc, getThumbnailSrc, setRemoteSource, removeSource, clearAllSources, hasLocalCopy, hasSource };
}
