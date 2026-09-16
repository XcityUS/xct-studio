import { businessStorage } from '@/features/persistence/store';

export type VerifiedPersonProfile = {
    name: string;
    coverUrl?: string;
    photoHashes?: Record<string, string>;
    photoGroups?: Record<string, string>;
};

export type VerifiedPersonProfiles = Record<string, VerifiedPersonProfile>;

const STORAGE_KEY = 'xctStudioVerifiedPeople';

export function verifiedPeopleSnapshot(): string | null {
    return typeof window === 'undefined' ? null : businessStorage.getItem(STORAGE_KEY);
}

export function parseVerifiedPeople(raw: string | null): VerifiedPersonProfiles {
    try {
        const value: unknown = JSON.parse(raw ?? '{}');
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return Object.fromEntries(
            Object.entries(value).flatMap(([id, raw]) => {
                if (!id || !raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
                const record = raw as Record<string, unknown>;
                const hashes = record.photoHashes;
                const groups = record.photoGroups;
                return [
                    [
                        id,
                        {
                            name: typeof record.name === 'string' ? record.name.trim() : '',
                            ...(typeof record.coverUrl === 'string' ? { coverUrl: record.coverUrl } : {}),
                            ...(hashes && typeof hashes === 'object' && !Array.isArray(hashes)
                                ? {
                                      photoHashes: Object.fromEntries(
                                          Object.entries(hashes).filter(
                                              (entry): entry is [string, string] => typeof entry[1] === 'string'
                                          )
                                      )
                                  }
                                : {}),
                            ...(groups && typeof groups === 'object' && !Array.isArray(groups)
                                ? {
                                      photoGroups: Object.fromEntries(
                                          Object.entries(groups).filter(
                                              (entry): entry is [string, string] =>
                                                  typeof entry[1] === 'string' && Boolean(entry[1])
                                          )
                                      )
                                  }
                                : {})
                        } satisfies VerifiedPersonProfile
                    ]
                ];
            })
        );
    } catch {
        return {};
    }
}

export function readVerifiedPeople(): VerifiedPersonProfiles {
    return parseVerifiedPeople(verifiedPeopleSnapshot());
}

export function writeVerifiedPeople(profiles: VerifiedPersonProfiles): void {
    if (typeof window !== 'undefined') businessStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export async function imageFingerprint(file: File): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function uniqueVerifiedGroups<T extends { id: string }>(groups: T[]): T[] {
    const seen = new Set<string>();
    return groups.filter((group) => {
        if (seen.has(group.id)) return false;
        seen.add(group.id);
        return true;
    });
}
