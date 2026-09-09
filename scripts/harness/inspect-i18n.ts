import { inspectTranslationCalls } from './i18n/calls.ts';
import { inspectDictionary } from './i18n/dictionaries.ts';
import type { RepositoryFinding } from './inspect-repository.ts';
import { sourcePattern } from './policy.ts';

export function inspectI18n(files: ReadonlyMap<string, string>): RepositoryFinding[] {
    const results: RepositoryFinding[] = [];
    const add = (path: string, message: string) =>
        results.push({ path, finding: { rule: 'i18n', level: 'error', message } });
    const enPath = 'src/i18n/messages/en.json';
    const zhPath = 'src/i18n/messages/zh.json';
    const en = inspectDictionary(files.get(enPath) ?? '', true);
    const zh = inspectDictionary(files.get(zhPath) ?? '', false);
    for (const message of en.errors) add(enPath, message);
    for (const message of zh.errors) add(zhPath, message);
    for (const key of en.messages.keys()) if (!zh.messages.has(key)) add(zhPath, `Missing English key: ${key}`);
    for (const key of zh.messages.keys()) if (!en.messages.has(key)) add(zhPath, `Unknown English key: ${key}`);
    const keys = new Set(en.messages.keys());
    for (const [path, source] of files) {
        if (!path.startsWith('src/') || !sourcePattern.test(path) || /\.(?:test|spec)\.tsx?$/.test(path)) continue;
        for (const error of inspectTranslationCalls(path, source, keys)) add(path, error);
    }
    return results;
}
