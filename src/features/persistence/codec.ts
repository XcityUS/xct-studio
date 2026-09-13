import { cleanJson, isObject, validateChange } from './validation';
import {
    type BusinessChange,
    type BusinessRecord,
    type BusinessTable,
    type Json
} from '@/shared/contracts/business-data';

export const PROJECT_KEY = 'xctStudioShortDramaProjects';
export const DRAFT_PREFIX = 'xctStudioStoryboardDraft:';
export const ASSEMBLY_PREFIX = 'xctStudioAssembly:';
export const QUEUE_KEY = 'xctStudioShotGenerationQueue';
export const HISTORY_KEY = 'soraVideoHistory';
const SIMPLE_KEYS = ['soraVideoHistoryUpdatedAt', 'soraVideoDeletedIds', 'xctStudioVideoMode', 'theme'];
export const LEGACY_KEYS = [
    PROJECT_KEY,
    QUEUE_KEY,
    HISTORY_KEY,
    'soraVideoCharacters',
    'soraVideoPortraits',
    'soraReferenceDeclarations',
    'xctStudioAssetNameAliases',
    ...SIMPLE_KEYS
];

export function supportedKey(key: string): boolean {
    return LEGACY_KEYS.includes(key) || key.startsWith(DRAFT_PREFIX) || key.startsWith(ASSEMBLY_PREFIX);
}

function row(table: BusinessTable, scope: string, id: unknown, data: unknown): BusinessChange {
    return validateChange({ table, scope, id, data, baseRevision: 0 });
}

function rows(table: BusinessTable, scope: string, values: unknown, ordered = false): BusinessChange[] {
    if (!Array.isArray(values)) throw new Error('INVALID_LIST');
    return values.map((data, position) => {
        if (!isObject(data)) throw new Error('INVALID_ITEM');
        return row(table, scope, data.id ?? data.assetId, ordered ? { ...data, _position: position } : data);
    });
}

function encodeDraft(key: string, data: Record<string, unknown>): BusinessChange[] {
    const scope = key.slice(DRAFT_PREFIX.length);
    if (typeof data.script !== 'string' || !Array.isArray(data.shots)) throw new Error('INVALID_DRAFT');
    const characters = rows('characters', scope, data.characters ?? [], true);
    const scenes = rows('scenes', scope, data.scenes ?? [], true);
    const shots = rows('shots', scope, data.shots, true);
    const bindings: BusinessChange[] = [];
    for (const item of [...characters, ...scenes, ...shots]) {
        const references = item.table === 'shots' ? item.data?.assetIds : [item.data?.assetId];
        if (Array.isArray(references))
            references.forEach((assetId, position) => {
                if (typeof assetId === 'string' && assetId)
                    bindings.push(
                        row('asset_bindings', scope, JSON.stringify([item.table, item.id, position]), {
                            entityType: item.table,
                            entityId: item.id,
                            assetId,
                            position
                        })
                    );
            });
        if (item.table === 'shots' && Array.isArray(item.data?.characterIds)) {
            item.data.characterIds.forEach((characterId, position) => {
                if (typeof characterId === 'string')
                    bindings.push(
                        row('shot_characters', scope, JSON.stringify([item.id, characterId]), {
                            shotId: item.id,
                            characterId,
                            position
                        })
                    );
            });
        }
    }
    return [
        row('script_versions', scope, 'draft', {
            script: data.script,
            globalNote: data.globalNote ?? '',
            automatic: data.automatic ?? false
        }),
        ...characters,
        ...scenes,
        ...shots,
        ...bindings
    ];
}

export function encodeDocument(key: string, raw: string): BusinessChange[] {
    if (!supportedKey(key)) throw new Error('UNSUPPORTED_STORAGE_KEY');
    const value: unknown = ['xctStudioVideoMode', 'theme'].includes(key) ? raw : JSON.parse(raw);
    if (key === PROJECT_KEY) {
        if (!isObject(value)) throw new Error('INVALID_PROJECTS');
        const projects = rows('projects', 'projects', value.projects);
        return [
            ...projects,
            ...rows('project_assets', 'projects', value.assets ?? []),
            ...rows('character_versions', 'projects', value.characterVersions ?? []),
            ...projects.map((p) =>
                row('episodes', 'projects', p.id, { projectId: p.id, title: 'Episode 1', position: 0 })
            ),
            row('user_preferences', 'preferences', 'activeProjectId', { value: value.activeProjectId ?? '' })
        ];
    }
    if (key.startsWith(DRAFT_PREFIX)) {
        if (!isObject(value)) throw new Error('INVALID_DRAFT');
        return encodeDraft(key, value);
    }
    if (key.startsWith(ASSEMBLY_PREFIX))
        return [row('episode_versions', 'assembly', key.slice(ASSEMBLY_PREFIX.length), value)];
    if (key === HISTORY_KEY) {
        const history = isObject(value) ? value.history : value;
        const jobs = rows('generation_jobs', 'history', history);
        return [
            ...jobs,
            ...jobs
                .filter((job) => job.data?.status === 'completed')
                .map((job) =>
                    row('generation_results', 'history', job.id, {
                        jobId: job.id,
                        storedUrl: job.data?.storedUrl ?? null,
                        providerUrl: job.data?.providerUrl ?? null,
                        projectId:
                            isObject(job.data?.createParams) &&
                            isObject(job.data.createParams.production) &&
                            isObject(job.data.createParams.production.project)
                                ? job.data.createParams.production.project.id
                                : null
                    })
                )
        ];
    }
    if (key === QUEUE_KEY)
        return rows('generation_jobs', 'queue', value, true).map((item) => {
            if (!isObject(item.data?.data) || typeof item.data.data.prompt !== 'string')
                throw new Error('INVALID_QUEUE');
            return item;
        });
    if (key === 'soraVideoCharacters') return rows('characters', 'library', value);
    if (key === 'soraVideoPortraits') {
        const assets = rows('provider_assets', 'library', value);
        return assets;
    }
    if (key === 'soraReferenceDeclarations' || key === 'xctStudioAssetNameAliases') {
        if (!isObject(value)) throw new Error('INVALID_MAP');
        return Object.entries(value).map(([id, data]) =>
            key === 'soraReferenceDeclarations'
                ? row('reference_declarations', 'library', id, data)
                : row('user_preferences', 'asset-aliases', id, { value: data })
        );
    }
    return [row('user_preferences', 'preferences', key, { value })];
}

function values(records: BusinessRecord[], table: BusinessTable, scope: string): Record<string, Json>[] {
    return records
        .filter((r) => r.table === table && r.scope === scope && r.data !== null)
        .sort((a, b) => Number(a.data?._position ?? 0) - Number(b.data?._position ?? 0))
        .map((r) => {
            const data = { ...r.data };
            delete data._position;
            return data;
        });
}

export function decodeDocument(key: string, records: BusinessRecord[]): string | null {
    const list = (table: BusinessTable, scope: string) => values(records, table, scope);
    const preference = (id: string) =>
        records.find((r) => r.table === 'user_preferences' && r.scope === 'preferences' && r.id === id)?.data?.value;
    if (key === PROJECT_KEY) {
        const projects = list('projects', 'projects');
        if (!projects.length) return null;
        return JSON.stringify({
            projects,
            assets: list('project_assets', 'projects'),
            characterVersions: list('character_versions', 'projects'),
            activeProjectId: preference('activeProjectId') ?? projects[0].id
        });
    }
    if (key.startsWith(DRAFT_PREFIX)) {
        const scope = key.slice(DRAFT_PREFIX.length);
        const draft = records.find((r) => r.table === 'script_versions' && r.scope === scope && r.id === 'draft')?.data;
        return draft
            ? JSON.stringify({
                  ...draft,
                  shots: list('shots', scope),
                  characters: list('characters', scope),
                  scenes: list('scenes', scope)
              })
            : null;
    }
    if (key.startsWith(ASSEMBLY_PREFIX)) {
        const data = records.find(
            (r) =>
                r.table === 'episode_versions' && r.scope === 'assembly' && r.id === key.slice(ASSEMBLY_PREFIX.length)
        )?.data;
        return data ? JSON.stringify(data) : null;
    }
    if (key === HISTORY_KEY) return JSON.stringify(list('generation_jobs', 'history'));
    if (key === QUEUE_KEY) return JSON.stringify(list('generation_jobs', 'queue'));
    if (key === 'soraVideoCharacters') return JSON.stringify(list('characters', 'library'));
    if (key === 'soraVideoPortraits') return JSON.stringify(list('provider_assets', 'library'));
    if (key === 'soraReferenceDeclarations' || key === 'xctStudioAssetNameAliases') {
        const table = key === 'soraReferenceDeclarations' ? 'reference_declarations' : 'user_preferences';
        const scope = key === 'soraReferenceDeclarations' ? 'library' : 'asset-aliases';
        return JSON.stringify(
            Object.fromEntries(
                records
                    .filter((r) => r.table === table && r.scope === scope && r.data)
                    .map((r) => [r.id, key === 'soraReferenceDeclarations' ? r.data : r.data?.value])
            )
        );
    }
    const pref = preference(key);
    if (pref === undefined || pref === null) return null;
    return ['xctStudioVideoMode', 'theme'].includes(key) ? String(pref) : JSON.stringify(pref);
}

export function allDocumentKeys(records: BusinessRecord[]): string[] {
    return [
        ...new Set([
            ...LEGACY_KEYS,
            ...records.filter((r) => r.table === 'script_versions').map((r) => DRAFT_PREFIX + r.scope),
            ...records.filter((r) => r.table === 'episode_versions').map((r) => ASSEMBLY_PREFIX + r.id)
        ])
    ];
}

export function safeRecordData(value: unknown): BusinessRecord['data'] {
    const clean = cleanJson(value);
    return isObject(clean) ? (clean as BusinessRecord['data']) : null;
}
