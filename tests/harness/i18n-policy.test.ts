import { inspectDictionary } from '../../scripts/harness/i18n/dictionaries';
import { isMessageKey, keyTokens, normalizeMessageKey } from '../../scripts/harness/i18n/keys';
import { inspectI18n } from '../../scripts/harness/inspect-i18n';
import { describe, expect, it } from 'vitest';

describe('English-copy message keys', () => {
    it.each([
        ["You're in dry mode", 'You<apos>re in dry mode'],
        ['Profit (%)', 'Profit <lpar><pct><rpar>'],
        ['Price ($)', 'Price <lpar><usd><rpar>'],
        ['A/B Test', 'A<slash>B Test'],
        [' .  Save   changes. ', 'Save changes'],
        ['Saving...', 'Saving'],
        ['Open xcity.ai.', 'Open xcity<dot>ai'],
        ['<b>Hello</b>', '<lt>b<gt>Hello<lt><slash>b<gt>'],
        ['\u00a9 {year} Xcity.', '<copy> <lcur>year<rcur> Xcity'],
        ['Assets \u2192 People.', 'Assets <rarr> People']
    ])('normalizes %s in the documented order', (english, key) => {
        expect(normalizeMessageKey(english)).toBe(key);
        expect(isMessageKey(key)).toBe(true);
    });

    it.each(Object.entries(keyTokens))('replaces %s once without re-encoding generated tokens', (char, token) => {
        expect(normalizeMessageKey(`A${char}B`)).toBe(`A<${token}>B`);
    });

    it.each(['', '...', '\u4e2d\u6587', 'caf\u0065\u0301', '\u2603'])(
        'rejects empty or unsupported source %s',
        (value) => {
            expect(() => normalizeMessageKey(value)).toThrow();
        }
    );

    it.each(['common.save', 'apiKey_title', ' A', 'A  B', 'A\nB', 'A<unknown>', '<APOS>', 'A<', ''])(
        'rejects invalid or semantic key %s',
        (key) => {
            const result = inspectDictionary(JSON.stringify({ [key]: 'Save' }), true);
            expect(result.errors.length).toBeGreaterThan(0);
        }
    );
});

describe('flat dictionary policy', () => {
    it.each([
        '[]',
        'null',
        '42',
        '{}',
        '{',
        '{"Save": {"title": "Save"}}',
        '{"Save": ["Save"]}',
        '{"Save": 1}',
        '{"Save": " "}'
    ])('rejects invalid dictionary %s', (source) => {
        expect(inspectDictionary(source, true).errors.length).toBeGreaterThan(0);
    });

    it('detects duplicate JSON keys before JSON.parse can discard them', () => {
        expect(inspectDictionary('{"Save":"Save", "\\u0053ave":"Save"}', true).errors).toContain(
            'Duplicate JSON key: Save'
        );
    });

    it('fails normalization collisions, including trailing punctuation differences', () => {
        const result = inspectDictionary('{"Save":"Save", "Old":"Save."}', true);
        expect(result.errors).toContain('English normalization collision: Save');
    });

    it('checks parity and production calls in the repository gate', () => {
        const files = new Map([
            ['src/i18n/messages/en.json', '{"Save":"Save"}'],
            ['src/i18n/messages/zh.json', '{"Open":"Open"}'],
            [
                'src/components/ui/Example/index.tsx',
                "import {useTranslations} from 'next-intl'; const t = useTranslations(); t(key);"
            ]
        ]);
        const errors = inspectI18n(files);
        expect(errors).toHaveLength(3);
        expect(errors.every(({ finding }) => finding.rule === 'i18n' && finding.level === 'error')).toBe(true);
    });

    it('requires both message files even if source code has no translations yet', () => {
        expect(inspectI18n(new Map())).toHaveLength(2);
    });
});
