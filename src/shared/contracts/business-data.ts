export const BUSINESS_TABLES = [
    'user_preferences',
    'projects',
    'episodes',
    'script_versions',
    'characters',
    'character_versions',
    'scenes',
    'shots',
    'shot_characters',
    'media_assets',
    'project_assets',
    'asset_bindings',
    'provider_asset_groups',
    'provider_assets',
    'reference_declarations',
    'generation_batches',
    'generation_jobs',
    'generation_results',
    'episode_versions',
    'exports',
    'asset_authorizations',
    'shares',
    'community_posts',
    'review_events'
] as const;

export type BusinessTable = (typeof BUSINESS_TABLES)[number];
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type BusinessRecord = {
    table: BusinessTable;
    scope: string;
    id: string;
    data: { [key: string]: Json } | null;
    revision: number;
};
export type BusinessChange = Omit<BusinessRecord, 'revision'> & { baseRevision: number };
export type BusinessWrite = { mode: 'import' | 'write'; changes: BusinessChange[] };
export type BusinessSnapshot = { owner: string; records: BusinessRecord[]; cursor: string | null };
export type BusinessWriteResult = { records: BusinessRecord[]; conflicts: string[] };

export function recordKey(record: Pick<BusinessRecord, 'table' | 'scope' | 'id'>): string {
    return JSON.stringify([record.table, record.scope, record.id]);
}
