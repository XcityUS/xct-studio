import { inspectDictionary } from '../../scripts/harness/i18n/dictionaries';
import en from '@/i18n/messages/en.json';
import zh from '@/i18n/messages/zh.json';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

describe('translation dictionaries', () => {
    it('uses flat normalized English keys, string values, and identical language key sets', () => {
        expect(inspectDictionary(JSON.stringify(en), true).errors).toEqual([]);
        expect(inspectDictionary(JSON.stringify(zh), false).errors).toEqual([]);
        expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    });

    it.each([
        { locale: 'zh' as const, messages: zh },
        { locale: 'en' as const, messages: en }
    ])('formats every $locale message without missing keys or malformed ICU syntax', ({ locale, messages }) => {
        const t = createTranslator({
            locale,
            messages,
            onError: (error) => {
                throw error;
            }
        });
        const values: Record<string, string | number> = {
            year: '2026',
            progress: 42,
            ready: 4,
            total: 18,
            completed: 4,
            missing: 14,
            generated: 2,
            requested: 3,
            projectName: 'Example project',
            seconds: '5',
            amount: '12.50',
            cost: '1.25',
            count: 3,
            currentCost: '12.50',
            date: '2026-09-07',
            failed: 1,
            expected: 12,
            matched: 11,
            blocking: 1,
            warnings: 2,
            required: 8,
            available: 5,
            id: 'clip-1',
            label: 'Image 1',
            limit: 9,
            max: 30,
            maxBudget: '10',
            min: 4,
            model: 'Seedance 2.5',
            name: 'Example',
            number: 1,
            size: '16:9 · 720p',
            status: 200,
            error: 'Example error',
            kind: 'image',
            note: 'Example note',
            reason: 'Example reason',
            title: 'Example video',
            width: '200',
            height: '100'
        };
        for (const key of Object.keys(messages)) {
            const translated = t(key as Parameters<typeof t>[0], values);
            expect(translated.trim().length, key).toBeGreaterThan(0);
            const expected = messages[key as keyof typeof messages].replace(/\{([A-Za-z]+)\}/g, (_, name: string) => {
                expect(values, `Missing interpolation fixture: ${name}`).toHaveProperty(name);
                return String(values[name]);
            });
            expect(translated).toBe(expected);
        }
    });

    it('uses distinct translations for the primary navigation and sign-in flow', () => {
        expect(zh['Video Studio']).not.toBe(en['Video Studio']);
        expect(zh['Sign in with Xcity']).not.toBe(en['Sign in with Xcity']);
    });
});
