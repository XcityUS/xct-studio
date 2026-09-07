import { isMessageKey, normalizeMessageKey } from './keys.ts';
import ts from 'typescript';

export interface DictionaryInspection {
    messages: Map<string, string>;
    errors: string[];
}

function duplicateKeys(source: string): string[] {
    const root = ts.parseJsonText('messages.json', source).statements[0]?.expression;
    if (!root || !ts.isObjectLiteralExpression(root)) return [];
    const seen = new Set<string>();
    const errors: string[] = [];
    for (const property of root.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name)) continue;
        const key = property.name.text;
        if (seen.has(key)) errors.push(`Duplicate JSON key: ${key}`);
        seen.add(key);
    }
    return errors;
}

export function inspectDictionary(source: string, english: boolean): DictionaryInspection {
    const messages = new Map<string, string>();
    const errors: string[] = [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(source);
    } catch {
        return { messages, errors: ['A valid JSON message dictionary is required.'] };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { messages, errors: ['Messages must be one flat JSON object.'] };
    }
    errors.push(...duplicateKeys(source));
    const normalized = new Map<string, string>();
    for (const [key, value] of Object.entries(parsed)) {
        if (!isMessageKey(key)) errors.push(`Invalid flat message key: ${key}`);
        if (typeof value !== 'string' || !value.trim()) {
            errors.push(`Message must be a nonempty string, never an object or array: ${key}`);
            continue;
        }
        messages.set(key, value);
        if (english) inspectEnglish(key, value, normalized, errors);
    }
    if (!messages.size) errors.push('The message dictionary must not be empty.');
    return { messages, errors };
}

function inspectEnglish(key: string, value: string, normalized: Map<string, string>, errors: string[]): void {
    try {
        const expected = normalizeMessageKey(value);
        if (key !== expected) errors.push(`Use the normalized English copy as key: ${key} -> ${expected}`);
        const previous = normalized.get(expected);
        if (previous !== undefined && previous !== value) errors.push(`English normalization collision: ${expected}`);
        normalized.set(expected, value);
    } catch {
        errors.push(`English copy cannot produce a supported key: ${key}`);
    }
}
