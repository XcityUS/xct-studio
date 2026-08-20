'use client';

import { db } from '@/lib/db';
import { captureVideoPoster, captureVideoPosterFromUrl } from '@/lib/thumbnail';
import type { VideoMetadata } from '@/types/video';
import * as React from 'react';

/** Captures run a few at a time — each one decodes a frame. */
const BACKFILL_BATCH = 3;

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
 * Runs batch after batch until every candidate has been tried. The previous
 * version stopped after the first three and only woke up again when history
 * changed, so a library of any size showed three thumbnails and placeholders
 * for the rest.
 */
export function usePosterBackfill({ history, enabled }: UsePosterBackfillOptions) {
    const attemptedRef = React.useRef<Set<string>>(new Set());
    const busyRef = React.useRef(false);
    // Bumped after each batch so this effect picks up the next one.
    const [pass, setPass] = React.useState(0);

    React.useEffect(() => {
        if (!enabled || busyRef.current) return;

        // Gated on storedUrl so the candidate list is finite and every entry
        // has a fallback source: items still waiting to be archived become
        // candidates when the archive hook sets storedUrl.
        const candidates = history.filter(
            (item) =>
                item.status === 'completed' &&
                Boolean(item.storedUrl) &&
                !attemptedRef.current.has(item.id)
        );
        if (candidates.length === 0) return;

        busyRef.current = true;
        let cancelled = false;

        void (async () => {
            try {
                for (const item of candidates.slice(0, BACKFILL_BATCH)) {
                    if (cancelled) return;
                    attemptedRef.current.add(item.id);

                    const existing = await db.videos.get(item.id);
                    if (existing?.thumbnail) continue;

                    const thumbnail = existing?.blob
                        ? await captureVideoPoster(existing.blob)
                        : item.storedUrl
                          ? await captureVideoPosterFromUrl(item.storedUrl)
                          : undefined;
                    if (!thumbnail || cancelled) continue;

                    await db.videos.put({
                        ...(existing ?? {}),
                        id: item.id,
                        filename: existing?.filename ?? item.filename ?? `${item.id}.mp4`,
                        created_at: existing?.created_at ?? Math.floor(item.timestamp / 1000),
                        thumbnail
                    });
                }
            } finally {
                busyRef.current = false;
                // Continue with the next batch. Every item above was marked
                // attempted, so the candidate list shrinks and this settles.
                if (!cancelled) setPass((p) => p + 1);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, history, pass]);
}
