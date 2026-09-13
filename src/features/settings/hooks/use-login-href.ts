'use client';

import { useSyncExternalStore } from 'react';
import { XCITY_LOGIN_URL, xcityLoginHref } from '../sso';

const subscribe = () => () => {};
const serverHref = () => XCITY_LOGIN_URL;

export function useLoginHref(): string {
    // Hydration uses the server value; the return URL is added after hydration.
    return useSyncExternalStore(subscribe, xcityLoginHref, serverHref);
}
