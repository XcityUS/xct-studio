'use client';

import type { VideoMetadata } from '@/types/video';
import * as React from 'react';

/** Kept under the historical name so existing users' history survives. */
const STORAGE_KEY = 'soraVideoHistory';

/**
 * Video history metadata, persisted to localStorage. Blobs live in IndexedDB
 * (src/lib/db.ts) — this is only the listing the panels render from.
 */
export function useVideoHistory() {
    const [history, setHistory] = React.useState<VideoMetadata[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);

    // Load once on mount
    React.useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: VideoMetadata[] = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setHistory(parsed);
                } else {
                    console.warn('Invalid history data found in localStorage.');
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem(STORAGE_KEY);
        }
        setIsInitialLoad(false);
    }, []);

    // Persist on change (after the initial load, so an empty first render
    // doesn't wipe stored history)
    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [history, isInitialLoad]);

    const addItem = React.useCallback((item: VideoMetadata) => {
        setHistory((prev) => [item, ...prev]);
    }, []);

    const updateItem = React.useCallback((id: string, patch: Partial<VideoMetadata>) => {
        setHistory((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    }, []);

    const removeItem = React.useCallback((id: string) => {
        setHistory((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const clearAll = React.useCallback(() => {
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    return { history, isInitialLoad, addItem, updateItem, removeItem, clearAll };
}
