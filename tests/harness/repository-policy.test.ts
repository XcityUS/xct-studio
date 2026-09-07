import { isClientModule, moduleReferences } from '../../scripts/harness/imports';
import { inspectRepository, packageManagerFindings } from '../../scripts/harness/inspect-repository';
import { describe, expect, it } from 'vitest';

const inspect = (files: Record<string, string>) => inspectRepository(new Map(Object.entries(files)));

describe('directory ownership', () => {
    it('accepts component entries, child components, and colocated styles', () => {
        expect(
            inspect({
                'src/components/ui/Input/index.tsx': "import styles from './index.module.scss';",
                'src/components/ui/Input/index.module.scss': '.root {}',
                'src/features/episode/components/Editor/Toolbar/index.tsx': 'export const Toolbar = () => null;',
                'src/app/layout.tsx': "import styles from './layout.module.scss';",
                'src/app/layout.module.scss': '.body {}'
            })
        ).toEqual([]);
    });

    it.each([
        'src/components/Editor/index.tsx',
        'src/hooks/use-new.ts',
        'src/types/new.ts',
        'src/data/new.ts',
        'src/lib/new-client.ts'
    ])('rejects catch-all ownership at %s', (path) => {
        expect(inspect({ [path]: '' })).toContainEqual(
            expect.objectContaining({ finding: expect.objectContaining({ rule: 'ownership' }) })
        );
    });

    it('does not require unused empty style files for unstyled components', () => {
        expect(inspect({ 'src/components/ui/Control/index.tsx': 'export const Control = () => null;' })).toEqual([]);
    });

    it('rejects business dependencies in reusable controls and shared helpers', () => {
        for (const path of [
            'src/components/ui/Input/index.tsx',
            'src/components/providers/ThemeProvider/index.tsx',
            'src/shared/utils/text.ts'
        ]) {
            expect(
                inspect({
                    [path]: "import { value } from '@/features/script/data';",
                    'src/features/script/data.ts': 'export const value = 1;'
                })
            ).toContainEqual(
                expect.objectContaining({ path, finding: expect.objectContaining({ rule: 'ownership' }) })
            );
        }
    });

    it('rejects redundant component /index imports', () => {
        expect(
            inspect({
                'src/app/[locale]/page.tsx': "import { Input } from '@/components/ui/Input/index';",
                'src/components/ui/Input/index.tsx': ''
            })[0].finding.rule
        ).toBe('name');
    });
});

describe('single localized page tree', () => {
    it.each([
        'src/app/page.tsx',
        'src/app/portrait-callback/page.tsx',
        'src/app/zh/page.tsx',
        'src/app/en/page.tsx',
        'src/app/[locale]/api/jobs/route.ts',
        'src/middleware.ts'
    ])('rejects duplicate routing at %s', (path) => {
        expect(inspect({ [path]: '' })).toContainEqual(
            expect.objectContaining({ finding: expect.objectContaining({ rule: 'ownership' }) })
        );
    });

    it('accepts one locale tree, nonlocalized APIs, and the Next 16 proxy', () => {
        expect(
            inspect({
                'src/app/[locale]/page.tsx': '',
                'src/app/[locale]/portrait-callback/page.tsx': '',
                'src/app/api/jobs/route.ts': '',
                'src/proxy.ts': ''
            })
        ).toEqual([]);
    });
});

describe('style ownership', () => {
    it.each([
        'src/components/ui/Input/styles.module.scss',
        'src/components/ui/Input/index.scss',
        'src/components/ui/Input/index.module.css',
        'src/components/ui/Orphan/index.module.scss'
    ])('rejects unowned or wrongly named %s', (path) => {
        expect(inspect({ [path]: '', 'src/components/ui/Input/index.tsx': '' })[0].finding.rule).toBe('styles');
    });

    it('rejects missing modules and another component stylesheet', () => {
        for (const specifier of [
            './missing.module.scss',
            '../Other/index.module.scss',
            '@/components/ui/Other/index.module.scss'
        ]) {
            expect(
                inspect({
                    'src/components/ui/Input/index.tsx': `import styles from '${specifier}';`,
                    'src/components/ui/Other/index.tsx': '',
                    'src/components/ui/Other/index.module.scss': ''
                })[0].finding.rule
            ).toBe('styles');
        }
    });
});

describe('server and provider boundaries', () => {
    it('requires an explicit server-only guard', () => {
        expect(inspect({ 'src/server/jobs/service.ts': 'export const jobs = [];' })[0].finding.rule).toBe('boundary');
        expect(inspect({ 'src/server/jobs/service.ts': "import 'server-only';" })).toEqual([]);
    });

    it.each([
        "import { secret } from '@/server/jobs/service';",
        "export * from '@/server/jobs/service';",
        "export { secret } from '@/server/jobs/service';",
        "const load = () => import('@/server/jobs/service');",
        "const load = () => require('@/server/jobs/service');"
    ])('follows a client barrel: %s', (barrel) => {
        expect(
            inspect({
                'src/features/episode/components/Editor/index.tsx':
                    "'use client'; import { secret } from '../../barrel';",
                'src/features/episode/barrel.ts': barrel,
                'src/server/jobs/service.ts': "import 'server-only'; export const secret = 1;"
            })
        ).toContainEqual(
            expect.objectContaining({
                path: 'src/features/episode/components/Editor/index.tsx',
                finding: expect.objectContaining({ rule: 'boundary' })
            })
        );
    });

    it('ignores type-only edges and terminates on runtime cycles', () => {
        expect(
            inspect({
                'src/features/episode/components/Editor/index.tsx':
                    "'use client'; import { type Data } from '@/server/jobs/service'; import '../../a';",
                'src/features/episode/a.ts': "export * from './b';",
                'src/features/episode/b.ts': "export * from './a'; export type { Data } from '@/server/jobs/service';",
                'src/server/jobs/service.ts': "import 'server-only'; export type Data = string;"
            })
        ).toEqual([]);
    });

    it('blocks provider SDKs outside server adapters without extending legacy exceptions', () => {
        expect(inspect({ 'src/features/generation/api.ts': "import OpenAI from 'openai';" })[0].finding.rule).toBe(
            'boundary'
        );
        expect(
            inspect({ 'src/server/providers/openai/client.ts': "import 'server-only'; import OpenAI from 'openai';" })
        ).toEqual([]);
        expect(inspect({ 'src/lib/openai-client.ts': "import OpenAI from 'openai';" })).toEqual([]);
    });
});

describe('AST import handling', () => {
    it('ignores import-looking strings and comments, retaining mixed runtime bindings', () => {
        const refs = moduleReferences(
            'src/example.ts',
            `
            // import 'server-only';
            const text = "import 'openai'";
            import type { One } from './types';
            import { type Two, value } from './mixed';
            import './side-effect';
        `
        );
        expect(refs).toEqual([
            { specifier: './types', runtime: false },
            { specifier: './mixed', runtime: true },
            { specifier: './side-effect', runtime: true }
        ]);
    });

    it('recognizes use client only in the directive prologue', () => {
        expect(isClientModule('src/example.tsx', "// header\n'use strict'; 'use client';")).toBe(true);
        expect(isClientModule('src/example.tsx', "const text = 'use client';")).toBe(false);
    });
});

describe('pnpm policy', () => {
    const valid = {
        'package.json': JSON.stringify({ packageManager: 'pnpm@10.34.5', engines: { pnpm: '10.34.5' } }),
        'pnpm-lock.yaml': ''
    };

    it('accepts matching exact pins and rejects other lockfiles', () => {
        expect(packageManagerFindings(new Map(Object.entries(valid)))).toEqual([]);
        for (const path of ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'bun.lock', 'bun.lockb']) {
            expect(packageManagerFindings(new Map(Object.entries({ ...valid, [path]: '' })))[0].path).toBe(path);
        }
    });

    it('rejects missing locks, malformed config, ranges, and mismatched pins', () => {
        expect(packageManagerFindings(new Map([['package.json', valid['package.json']]]))[0].path).toBe(
            'pnpm-lock.yaml'
        );
        for (const pkg of [
            '{',
            '{}',
            '{"packageManager":"pnpm@^10.34.5"}',
            '{"packageManager":"pnpm@10.34.5","engines":{"pnpm":"10.0.0"}}'
        ]) {
            expect(packageManagerFindings(new Map(Object.entries({ ...valid, 'package.json': pkg })))[0].path).toBe(
                'package.json'
            );
        }
    });
});
