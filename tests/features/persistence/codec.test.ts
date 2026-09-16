import { decodeDocument, encodeDocument, PROJECT_KEY, DRAFT_PREFIX } from '@/features/persistence/codec';
import { cleanJson, validateChange } from '@/features/persistence/validation';
import type { BusinessRecord } from '@/shared/contracts/business-data';
import { describe, expect, it } from 'vitest';

describe('PostgreSQL compatibility records', () => {
    it('round trips projects without using titles as identities', () => {
        const state = {
            activeProjectId: 'p1',
            projects: [
                { id: 'p1', title: 'Same' },
                { id: 'p2', title: 'Same' }
            ],
            assets: [{ id: 'a', projectId: 'p1', name: 'Person', kind: 'character' }],
            characterVersions: []
        };
        const rows: BusinessRecord[] = encodeDocument(PROJECT_KEY, JSON.stringify(state)).map((r) => ({
            ...r,
            revision: 1
        }));
        expect(JSON.parse(decodeDocument(PROJECT_KEY, rows)!)).toEqual(state);
    });

    it('persists verified-person names and covers separately per provider group', () => {
        const profiles = {
            'group-1': { name: 'Alex', coverUrl: 'https://example.com/cover.png', photoHashes: { abc: 'asset-1' } },
            'group-2': { name: 'Sam' }
        };
        const rows = encodeDocument('xctStudioVerifiedPeople', JSON.stringify(profiles)).map((change) => ({
            ...change,
            revision: 1
        }));
        expect(rows.map((row) => row.scope)).toEqual(['verified-people', 'verified-people']);
        expect(JSON.parse(decodeDocument('xctStudioVerifiedPeople', rows)!)).toEqual(profiles);
    });

    it('preserves stable shot ids, order and character bindings', () => {
        const draft = {
            script: 'Story',
            globalNote: '',
            automatic: true,
            characters: [{ id: 'c', name: 'Lead', assetId: 'asset://person' }],
            scenes: [{ id: 's', name: 'Station', assetId: 'asset://station' }],
            shots: [
                { id: 'b', description: 'Second', characterIds: ['c'], sceneId: 's' },
                { id: 'a', description: 'First' }
            ]
        };
        const changes = encodeDocument(DRAFT_PREFIX + 'project', JSON.stringify(draft));
        expect(changes.some((c) => c.table === 'shot_characters' && c.data?.characterId === 'c')).toBe(true);
        expect(changes.filter((c) => c.table === 'asset_bindings')).toHaveLength(2);
        expect(
            JSON.parse(
                decodeDocument(
                    DRAFT_PREFIX + 'project',
                    changes.map((r) => ({ ...r, revision: 1 }))
                )!
            )
        ).toEqual(draft);
    });

    it('does not export credentials, blobs or unrelated storage keys', () => {
        expect(() => encodeDocument('openaiApiKey', 'sk-test')).toThrow();
        expect(
            cleanJson({
                title: 'Keep',
                apiKey: 'secret',
                password: 'secret',
                authorizationId: 'allowed',
                nested: { access_token: 'secret' },
                sourceUrl: 'blob:local-only'
            })
        ).toEqual({
            title: 'Keep',
            authorizationId: 'allowed',
            nested: {},
            sourceUrl: null
        });
    });

    it('rejects malformed records and table-name injection', () => {
        expect(() =>
            validateChange({
                table: 'projects; DROP TABLE studio_users',
                scope: 'x',
                id: 'x',
                data: {},
                baseRevision: 0
            })
        ).toThrow();
        expect(() =>
            encodeDocument(DRAFT_PREFIX + 'p', JSON.stringify({ script: '', shots: [{ id: 'x' }] }))
        ).toThrow();
    });

    it('honors tombstones when reconstructing history', () => {
        expect(
            decodeDocument('soraVideoHistory', [
                { table: 'generation_jobs', scope: 'history', id: 'old', data: null, revision: 2 }
            ])
        ).toBe('[]');
    });
});
