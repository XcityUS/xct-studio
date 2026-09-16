'use client';

import { isLocalStudioHost } from '@/features/settings/sso';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getServerSnapshot = () => false;
const getSnapshot = () => isLocalStudioHost(window.location.hostname);

/** Manual TokenHub keys are a localhost-only development fallback. */
export function useLocalApiKeyOption(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
