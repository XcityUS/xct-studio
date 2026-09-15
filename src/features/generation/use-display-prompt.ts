'use client';

import { cleanPromptForReuse } from '@/features/script/prompt/guards';
import * as React from 'react';

const subscribeToLocation = () => () => undefined;
const getServerDebugMode = () => false;

function isLocalDevelopmentHostname(hostname: string): boolean {
    return (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '[::1]'
    );
}

export function isCompiledPromptDebugEnabled(hostname: string, search: string): boolean {
    return isLocalDevelopmentHostname(hostname) && new URLSearchParams(search).get('debug') === 'true';
}

function getBrowserDebugMode(): boolean {
    return isCompiledPromptDebugEnabled(window.location.hostname, window.location.search);
}

export function useDisplayedPrompt(prompt: string, sourcePrompt?: string): string {
    const showCompiledPrompt = React.useSyncExternalStore(subscribeToLocation, getBrowserDebugMode, getServerDebugMode);
    const userPrompt = sourcePrompt?.trim() || cleanPromptForReuse(prompt);
    return showCompiledPrompt ? prompt : userPrompt;
}
