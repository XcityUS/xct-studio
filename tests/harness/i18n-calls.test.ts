import { inspectTranslationCalls } from '../../scripts/harness/i18n/calls';
import { describe, expect, it } from 'vitest';

const keys = new Set(['Save', 'A<slash>B Test']);
const inspect = (source: string) => inspectTranslationCalls('src/example.tsx', source, keys);
const client = (body: string) =>
    `import {useTranslations} from 'next-intl'; function View() {const t = useTranslations(); ${body}}`;

describe('translation call policy', () => {
    it.each([
        "t('Save');",
        "t.rich('Save', {b: (value) => value});",
        "t.raw('Save');",
        "t.markup('Save');",
        "t.has('Save');",
        't(`Save`);'
    ])('allows static root keys: %s', (body) => {
        expect(inspect(client(body))).toEqual([]);
    });

    it.each([
        't(key);',
        't(server.messageKey);',
        't(`Save ${name}`);',
        "t('Sa' + 've');",
        't.raw(key);',
        't.has(key);',
        't();'
    ])('rejects dynamic or missing key: %s', (body) => {
        expect(inspect(client(body)).join()).toContain('static literals');
    });

    it.each(["t('common.save');", "t('A/B Test');"])('rejects non-normalized key: %s', (body) => {
        expect(inspect(client(body)).join()).toContain('normalized flat English');
    });

    it('rejects undeclared keys', () => {
        expect(inspect(client("t('Missing');")).join()).toContain('missing from en.json');
    });

    it('checks import aliases without mistaking a shadowed unrelated function for a translator', () => {
        expect(
            inspect(`import {useTranslations as useCopy} from 'next-intl';
            const copy = useCopy(); copy('Save');
            function unrelated(copy) { copy(dynamic); }
            // copy(dynamic);
            const comment = "copy(dynamic)";`)
        ).toEqual([]);
        expect(
            inspect("import {useTranslations as useCopy} from 'next-intl'; const copy = useCopy(); copy(key);").join()
        ).toContain('static literals');
    });

    it('checks server and namespace imports with root options', () => {
        expect(
            inspect(
                "import * as intl from 'next-intl/server'; const copy = await intl.getTranslations({locale}); copy('Save');"
            )
        ).toEqual([]);
        expect(
            inspect(
                "import {createTranslator} from 'next-intl'; const copy = createTranslator({locale, messages}); copy('Save');"
            )
        ).toEqual([]);
    });

    it.each([
        "import {useTranslations} from 'next-intl'; const t = useTranslations('apiKey');",
        "import {getTranslations} from 'next-intl/server'; const t = await getTranslations('apiKey');",
        "import {getTranslations} from 'next-intl/server'; const t = await getTranslations({locale, namespace: 'apiKey'});",
        "import {getTranslations} from 'next-intl/server'; const t = await getTranslations(options);",
        "import {getTranslations} from 'next-intl/server'; const t = await getTranslations({...options});",
        "import {createTranslator} from 'next-intl'; const t = createTranslator({locale, messages, namespace: 'apiKey'});"
    ])('rejects explicit or hidden namespaces', (source) => {
        expect(inspect(source).join()).toContain('no namespace');
    });

    it.each(['const alias = t; alias(key);', 'const {rich} = t; rich(key);', 'renderWith(t);', "t['raw'](key);"])(
        'rejects translator escape: %s',
        (body) => {
            expect(inspect(client(body)).join()).toContain('Call the local translator directly');
        }
    );

    it('rejects unbound translator factories', () => {
        expect(inspect("import {useTranslations} from 'next-intl'; useTranslations()(key);").join()).toContain(
            'Bind the root translator'
        );
    });

    it.each([
        "import {useTranslations} from 'next-intl'; const getCopy = useTranslations;",
        "import * as intl from 'next-intl'; const getCopy = intl.useTranslations;",
        "export {getTranslations as getCopy} from 'next-intl/server';",
        "export * from 'next-intl';"
    ])('rejects aliases or re-exports hiding translation factories', (source) => {
        expect(inspect(source).join()).toContain('translation factories directly');
    });

    it('does not inspect unrelated functions or other libraries named t/useTranslations', () => {
        expect(
            inspect(
                "import {useTranslations} from 'another-library'; const t = useTranslations('namespace'); t(variable);"
            )
        ).toEqual([]);
        expect(inspect("import {hasLocale} from 'next-intl'; function t(key) {} t(variable);")).toEqual([]);
    });
});
