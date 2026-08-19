'use client';

import { db } from '@/lib/db';
import { captureVideoPosterFromUrl } from '@/lib/thumbnail';
import type { VideoMetadata } from '@/types/video';
import * as React from 'react';

const MAX_BACKFILLS_PER_PASS = 3;

interface UsePosterBackfillOptions {
    history: VideoMetadata[];
    enabled: boolean;
}

/**
 * Backfills missing history posters from permanent R2 copies.
 *
 * R2 media is CORS-open, so clips that arrived through cloud sync can still
 * get a poster even when this browser never downloaded the MP4 into IndexedDB.
 */
export function usePosterBackfill({ history, enabled }: UsePosterBackfillOptions) {
    const attemptedRef = React.useRef<Set<string>>(new Set());
    const busyRef = React.useRef(false);

    React.useEffect(() => {
        if (!enabled || busyRef.current) return;

        const candidates = history.filter(
            (item) => item.status === 'completed' && Boolean(item.storedUrl) && !attemptedRef.current.has(item.id)
        );
        if (candidates.length === 0) return;

        busyRef.current = true;
        let cancelled = false;

        void (async () => {
            try {
                let storedCount = 0;
                for (const item of candidates) {
                    if (cancelled || storedCount >= MAX_BACKFILLS_PER_PASS) return;
                    attemptedRef.current.add(item.id);

                    const existing = await db.videos.get(item.id);
                    if (existing?.thumbnail || !item.storedUrl) continue;

                    const thumbnail = await captureVideoPosterFromUrl(item.storedUrl);
                    if (!thumbnail) continue;

                    await db.videos.put({
                        ...(existing ?? {}),
                        id: item.id,
                        filename: existing?.filename ?? item.filename ?? `${item.id}.mp4`,
                        created_at: existing?.created_at ?? Math.floor(item.timestamp / 1000),
                        thumbnail
                    });
                    storedCount += 1;
                }
            } finally {
                busyRef.current = false;
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, history]);
}
