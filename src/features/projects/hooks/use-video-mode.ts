'use client';

import { businessStorage } from '@/features/persistence/store';


import * as React from 'react';

type VideoMode = 'normal' | 'drama';
let mode: VideoMode = 'normal';
const listeners = new Set<() => void>();

function readMode(): VideoMode {
    if (typeof window === 'undefined') return mode;
    try {
        return businessStorage.getItem('xctStudioVideoMode') === 'drama' ? 'drama' : 'normal';
    } catch {
        return mode;
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    queueMicrotask(listener);
    const handleStorage = (event: StorageEvent) => {
        if (event.key !== 'xctStudioVideoMode') return;
        mode = readMode();
        listener();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', handleStorage);
    };
}
export function useVideoMode() {
    const value = React.useSyncExternalStore(subscribe, readMode, () => mode);
    return [
        value,
        (next: VideoMode) => {
            mode = next;
            try {
                businessStorage.setItem('xctStudioVideoMode', next);
            } catch {
                /* Keep the in-memory selection. */
            }
            listeners.forEach((listener) => listener());
        }
    ] as const;
}
