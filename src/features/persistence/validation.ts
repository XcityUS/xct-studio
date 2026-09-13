import { BUSINESS_TABLES, type BusinessChange, type BusinessRecord, type Json } from '@/shared/contracts/business-data';

const SECRET_FIELD =
    /^(?:api[_-]?key|keyRef|password|secret|access[_-]?token|refresh[_-]?token|authorization|bearer|database[_-]?url|byteplus[_-]?(?:ak|sk))$/i;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'blob', 'thumbnail']);

export function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function cleanJson(value: unknown, depth = 0): Json {
    if (depth > 40) throw new Error('DATA_TOO_DEEP');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        if (/^(?:blob:|data:)/i.test(value)) return null;
        return value
            .replace(/\bsk-[a-zA-Z0-9_-]{16,}/g, '[redacted]')
            .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[redacted]')
            .replace(/Bearer\s+[a-zA-Z0-9._~+/-]{16,}/gi, '[redacted]');
    }
    if (Array.isArray(value)) return value.map((item) => cleanJson(item, depth + 1));
    if (!isObject(value)) return null;
    const result: Record<string, Json> = {};
    for (const [key, item] of Object.entries(value)) {
        if (SECRET_FIELD.test(key) || FORBIDDEN_KEYS.has(key) || item === undefined) continue;
        result[key] = cleanJson(item, depth + 1);
    }
    return result;
}

function identifier(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f]/.test(value);
}

export function validateChange(value: unknown): BusinessChange {
    if (
        !isObject(value) ||
        !BUSINESS_TABLES.includes(value.table as BusinessRecord['table']) ||
        !identifier(value.scope) ||
        !identifier(value.id) ||
        !Number.isSafeInteger(value.baseRevision) ||
        Number(value.baseRevision) < 0 ||
        (value.data !== null && !isObject(value.data))
    )
        throw new Error('INVALID_RECORD');
    const data = cleanJson(value.data) as BusinessRecord['data'];
    if (data) {
        if (value.table === 'projects' && typeof data.title !== 'string') throw new Error('INVALID_PROJECT');
        if (value.table === 'shots' && typeof data.description !== 'string') throw new Error('INVALID_SHOT');
        if (value.table === 'script_versions' && typeof data.script !== 'string') throw new Error('INVALID_SCRIPT');
        if (
            ['characters', 'scenes', 'character_versions', 'project_assets'].includes(String(value.table)) &&
            typeof data.name !== 'string'
        )
            throw new Error('INVALID_NAME');
        if (
            value.table === 'generation_jobs' &&
            value.scope === 'history' &&
            (typeof data.prompt !== 'string' || typeof data.model !== 'string')
        )
            throw new Error('INVALID_JOB');
        if (
            value.table === 'generation_jobs' &&
            value.scope.startsWith('queue:') &&
            (!isObject(data.data) || typeof data.data.prompt !== 'string' || typeof data.data.model !== 'string')
        ) {
            throw new Error('INVALID_QUEUE');
        }
        if (
            value.table === 'reference_declarations' &&
            (typeof data.origin !== 'string' || typeof data.declaredAt !== 'number')
        )
            throw new Error('INVALID_DECLARATION');
    }
    return {
        table: value.table as BusinessRecord['table'],
        scope: value.scope,
        id: value.id,
        data,
        baseRevision: Number(value.baseRevision)
    };
}
