'use client';

import {
    parseVerifiedPeople,
    readVerifiedPeople,
    verifiedPeopleSnapshot,
    writeVerifiedPeople,
    type VerifiedPersonProfile
} from '../portrait/people';
import { subscribeBusiness } from '@/features/persistence/store';
import * as React from 'react';

export function useVerifiedPeople() {
    const snapshot = React.useSyncExternalStore(subscribeBusiness, verifiedPeopleSnapshot, () => null);
    const profiles = React.useMemo(() => parseVerifiedPeople(snapshot), [snapshot]);

    const save = React.useCallback((groupId: string, patch: Partial<VerifiedPersonProfile>) => {
        const current = readVerifiedPeople();
        writeVerifiedPeople({
            ...current,
            [groupId]: {
                ...current[groupId],
                ...patch,
                name: patch.name ?? current[groupId]?.name ?? ''
            }
        });
    }, []);
    const remove = React.useCallback((groupId: string) => {
        const next = { ...readVerifiedPeople() };
        delete next[groupId];
        writeVerifiedPeople(next);
    }, []);
    return { profiles, save, remove };
}
