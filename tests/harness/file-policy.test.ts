import { functionFindings, inspectSource, uiFindings } from '../../scripts/harness/inspect-source';
import { countLines, filePolicy, namingFindings, sizeFindings } from '../../scripts/harness/policy';
import { describe, expect, it } from 'vitest';

describe('file policy', () => {
    it.each([
        ['src/features/episode/episode.types.ts', 300, 500],
        ['src/features/episode/components/shot-editor.tsx', 250, 500],
        ['src/features/episode/hooks/use-shots.ts', 200, 500],
        ['src/shared/utils/time.ts', 200, 500],
        ['src/server/generation-service.ts', 300, 500],
        ['src/app/[locale]/page.tsx', 100, 200],
        ['src/app/api/jobs/route.ts', 100, 200],
        ['src/features/episode/editor.module.css', 200, 400],
        ['src/components/ui/Input/index.module.scss', 200, 400],
        ['src/features/episode/components/Editor/index.tsx', 250, 500],
        ['src/features/episode/components/Editor/hooks.ts', 200, 500],
        ['src/features/episode/components/Editor/utils.ts', 200, 500],
        ['tests/features/episode.test.tsx', 500, undefined]
    ])('classifies %s', (path, soft, hard) => {
        expect(filePolicy(path)).toMatchObject({ soft, ...(hard === undefined ? {} : { hard }) });
        expect(filePolicy(path).hard).toBe(hard);
    });

    it('allows exactly 500 source lines and blocks 501', () => {
        expect(sizeFindings('src/service.ts', 500).some((f) => f.level === 'error')).toBe(false);
        expect(sizeFindings('src/service.ts', 501)).toEqual([expect.objectContaining({ level: 'error' })]);
    });

    it('makes soft limits advisory, not failures', () => {
        expect(sizeFindings('src/editor.tsx', 250)).toEqual([]);
        expect(sizeFindings('src/editor.tsx', 251)[0].level).toBe('warning');
        expect(sizeFindings('tests/editor.test.ts', 900)[0].level).toBe('warning');
    });

    it('does not apply source size rules to data or configuration', () => {
        for (const path of ['src/messages.json', 'scripts/tool.config.ts', 'docs/plan.md']) {
            expect(sizeFindings(path, 3000)).toEqual([]);
        }
    });

    it('does not let a generated comment exempt handwritten source', () => {
        expect(inspectSource('src/generated.ts', '// generated\n'.repeat(501))).toContainEqual(
            expect.objectContaining({ level: 'error', rule: 'file-size' })
        );
    });

    it('counts physical lines without adding an empty trailing line', () => {
        expect(countLines('')).toBe(0);
        expect(countLines('one\n')).toBe(1);
        expect(countLines('one\r\n\r\ntwo')).toBe(3);
    });
});

describe('legacy budgets', () => {
    const legacy = { maxLines: 900, reason: 'Existing editor; tracked split required.' };

    it('permits existing debt but rejects growth', () => {
        expect(sizeFindings('src/editor.tsx', 900, legacy)[0].level).toBe('warning');
        expect(sizeFindings('src/editor.tsx', 901, legacy)[0].level).toBe('error');
    });

    it('rejects missing migration reasons and obsolete entries', () => {
        expect(sizeFindings('src/editor.tsx', 800, { ...legacy, reason: '' })[0].rule).toBe('baseline');
        expect(sizeFindings('src/editor.tsx', 500, legacy)[0].rule).toBe('baseline');
    });
});

describe('names and implementation language', () => {
    it.each([
        'src/app/[locale]/page.tsx',
        'src/app/[...slug]/page.tsx',
        'src/app/[[...slug]]/page.tsx',
        'src/app/(studio)/layout.tsx',
        'src/features/episode/episode.types.ts',
        'src/components/ui/Input/index.tsx',
        'src/components/ui/Input/index.module.scss',
        'src/features/episode/components/Editor/types.ts',
        'src/features/episode/components/Editor/Toolbar/index.tsx',
        'docs/README.md'
    ])('accepts %s', (path) => {
        expect(namingFindings(path)).toEqual([]);
    });

    it.each([
        'src/components/ShotEditor.tsx',
        'src/components/ui/input.tsx',
        'src/components/ui/input/index.tsx',
        'src/features/episode/components/Editor/editor.tsx',
        'src/features/episode/view.tsx',
        'src/features/shot_editor.ts',
        'src/features/NewFeature/editor.ts'
    ])('rejects %s', (path) => {
        expect(namingFindings(path)[0].rule).toBe('name');
    });

    it('does not extend legacy JavaScript exceptions to new files', () => {
        expect(namingFindings('scripts/copy-ffmpeg-core.mjs')).toEqual([]);
        expect(namingFindings('scripts/generate-video.mjs')[0].rule).toBe('typescript');
    });

    it('rejects moudle typos and malformed route segments', () => {
        expect(namingFindings('src/components/ui/Input/index.moudle.scss')[0].rule).toBe('name');
        expect(namingFindings('src/app/[[slug]/page.tsx')[0].rule).toBe('name');
    });
});

describe('AST function inspection', () => {
    it('warns at 51 lines, including JSX, and accepts 50', () => {
        const body = (lines: number) => `export function Editor() {\n${'  // keep context\n'.repeat(lines - 2)}}`;
        expect(functionFindings('src/editor.tsx', body(50))).toEqual([]);
        expect(functionFindings('src/editor.tsx', body(51))[0].rule).toBe('function-size');
    });

    it('counts arrow functions but not braces in strings', () => {
        expect(functionFindings('src/helper.ts', `const fn = () => {\n${'  // line\n'.repeat(49)}}`)).toHaveLength(1);
        expect(functionFindings('src/helper.ts', 'const text = "function x() { }";')).toEqual([]);
    });
});

describe('UI control inspection', () => {
    it('rejects native selects and accepts the shared Dropdown', () => {
        expect(
            uiFindings('src/components/Form/index.tsx', 'const field = <select><option>A</option></select>;')
        ).toEqual([expect.objectContaining({ level: 'error', rule: 'ui' })]);
        expect(uiFindings('src/components/Form/index.tsx', 'const field = <Dropdown options={[]} />;')).toEqual([]);
    });

    it('ignores select text and non-TSX files', () => {
        expect(uiFindings('src/components/Form/index.tsx', 'const text = "<select>";')).toEqual([]);
        expect(uiFindings('docs/example.md', '<select></select>')).toEqual([]);
    });
});
