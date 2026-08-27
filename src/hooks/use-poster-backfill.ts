'use client';

import { db } from '@/lib/db';
import { captureVideoPoster, captureVideoPosterFromUrl } from '@/lib/thumbnail';
import type { VideoMetadata } from '@/types/video';
import * as React from 'react';

/** Captures run a few at a time — each one decodes a frame. */
const BACKFILL_BATCH = 3;
const RETRY_DELAY_MS = 60_000;

interface UsePosterBackfillOptions {
    history: VideoMetadata[];
    enabled: boolean;
}

/**
 * Backfills missing history posters.
 *
 * Two sources, in order: a local blob in IndexedDB (older entries stored the
 * MP4 before posters existed), then the permanent R2 copy — R2 is CORS-open
 * and range-served, so clips that arrived through cloud sync get a poster
 * without this browser ever downloading the whole file.
 *
 * Runs batch after batch until every candidate has a thumbnail or is waiting
 * for its retry window. The previous version stopped after the first three
 * and only woke up again when history changed, so a library of any size
 * showed three thumbnails and placeholders for the rest.
 */
export function usePosterBackfill({ history, enabled }: UsePosterBackfillOptions) {
    const retryAfterRef = React.useRef<Map<string, number>>(new Map());
    const busyRef = React.useRef(false);
    // Bumped after each batch so this effect picks up the next one.
    const [pass, setPass] = React.useState(0);

    React.useEffect(() => {
        if (!enabled || busyRef.current) return;

        // Gated on storedUrl so the candidate list is finite and every entry
        // has a fallback source: items still waiting to be archived become
        // candidates when the archive hook sets storedUrl.
        const now = Date.now();
        const candidates = history.filter(
            (item) =>
                item.status === 'completed' &&
                Boolean(item.storedUrl) &&
                (retryAfterRef.current.get(item.id) ?? 0) <= now
        );
        if (candidates.length === 0) {
            const nextRetryAt = Math.min(...Array.from(retryAfterRef.current.values()).filter((retryAt) => retryAt > now));
            if (!Number.isFinite(nextRetryAt)) return;
            const timer = window.setTimeout(() => setPass((p) => p + 1), Math.max(1_000, nextRetryAt - now));
            return () => window.clearTimeout(timer);
        }

        busyRef.current = true;
        let cancelled = false;

        void (async () => {
            try {
                for (const item of candidates.slice(0, BACKFILL_BATCH)) {
                    if (cancelled) return;

                    const existing = await db.videos.get(item.id);
                    if (existing?.thumbnail) continue;

                    const thumbnail = existing?.blob
                        ? await captureVideoPoster(existing.blob)
                        : item.storedUrl
                          ? await captureVideoPosterFromUrl(item.storedUrl)
                          : undefined;
                    if (!thumbnail || cancelled) {
                        retryAfterRef.current.set(item.id, Date.now() + RETRY_DELAY_MS);
                        continue;
                    }

                    await db.videos.put({
                        ...(existing ?? {}),
                        id: item.id,
                        filename: existing?.filename ?? item.filename ?? `${item.id}.mp4`,
                        created_at: existing?.created_at ?? Math.floor(item.timestamp / 1000),
                        thumbnail
                    });
                    retryAfterRef.current.delete(item.id);
                }
            } finally {
                busyRef.current = false;
                // Continue with the next batch. Successful items now have
                // thumbnails; failed items wait until their retry window.
                if (!cancelled) setPass((p) => p + 1);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, history, pass]);
}
