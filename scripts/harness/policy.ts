export interface FilePolicy {
    kind: string;
    soft?: number;
    hard?: number;
}

export interface Finding {
    rule:
        | 'name'
        | 'typescript'
        | 'file-size'
        | 'function-size'
        | 'baseline'
        | 'ownership'
        | 'styles'
        | 'boundary'
        | 'i18n'
        | 'ui'
        | 'pnpm';
    level: 'warning' | 'error';
    message: string;
}

export interface LegacyEntry {
    maxLines: number;
    reason: string;
}

export type LegacyBaseline = Record<string, LegacyEntry>;

export const scanRoots = ['src', 'scripts', 'tests', 'bench', 'docs'];
export const sourcePattern = /\.[cm]?tsx?$/;
export const inspectedPattern = /\.(?:[cm]?[jt]sx?|s?css|md|json)$/;
const legacyJavaScript = new Set(['scripts/copy-ffmpeg-core.mjs', 'scripts/upload-gallery.mjs']);
const reservedNames = new Set(['AGENTS.md', 'README.md', 'ROADMAP.md', 'RELEASE_NOTES.md']);

export function countLines(source: string): number {
    if (!source) return 0;
    const lines = source.split(/\r\n|\r|\n/);
    return lines.length - (lines.at(-1) === '' ? 1 : 0);
}

export function filePolicy(path: string): FilePolicy {
    if (/\.(test|spec|bench)\.[cm]?tsx?$/.test(path)) {
        return { kind: 'test', soft: 500 };
    }
    if (/\.config\.[cm]?tsx?$/.test(path)) return { kind: 'configuration' };
    if (/\.module\.s?css$/.test(path)) return { kind: 'css-module', soft: 200, hard: 400 };
    if (!sourcePattern.test(path)) return { kind: 'non-source' };
    if (
        /^src\/app\/.*\/(page|layout|route|loading|error|not-found)\.tsx?$/.test(path) ||
        /^src\/app\/(page|layout|route|loading|error|not-found)\.tsx?$/.test(path)
    ) {
        return { kind: 'route', soft: 100, hard: 200 };
    }
    if (/\/(?:use-[^/]+|hooks)\.tsx?$/.test(path) || path.includes('/hooks/')) {
        return { kind: 'hook', soft: 200, hard: 500 };
    }
    if (path.endsWith('.tsx')) return { kind: 'component', soft: 250, hard: 500 };
    if (/\/utils(?:\/|\.)|[-.]utils\./.test(path)) {
        return { kind: 'utility', soft: 200, hard: 500 };
    }
    return { kind: 'typescript', soft: 300, hard: 500 };
}

function validSegment(segment: string, isDirectory: boolean, componentDirectory: boolean): boolean {
    if (reservedNames.has(segment) && !isDirectory) return true;
    if (segment === '.gitkeep') return true;
    if (componentDirectory && /^[A-Z][a-zA-Z0-9]*$/.test(segment)) return true;
    if (isDirectory && /^(?:\[(?:\.\.\.)?[a-z][a-zA-Z0-9]*\]|\[\[\.\.\.[a-z][a-zA-Z0-9]*\]\])$/.test(segment))
        return true;
    if (isDirectory && /^\([a-z0-9]+(?:-[a-z0-9]+)*\)$/.test(segment)) return true;
    return /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(segment);
}

export function namingFindings(path: string): Finding[] {
    const segments = path.split('/');
    const findings: Finding[] = [];
    const componentRoot = segments.indexOf('components');
    if (
        segments.some(
            (segment, index) =>
                !validSegment(
                    segment,
                    index < segments.length - 1,
                    componentRoot !== -1 && index > componentRoot && index < segments.length - 1
                )
        )
    ) {
        findings.push({
            rule: 'name',
            level: 'error',
            message:
                'Use PascalCase component directories with index.tsx; ordinary names use kebab-case (framework names are exempt).'
        });
    }
    if (/\.moudle\.s?css$/.test(path)) {
        findings.push({
            rule: 'name',
            level: 'error',
            message: 'Use index.module.scss, not the misspelled moudle suffix.'
        });
    }
    if (
        path.startsWith('src/') &&
        !path.startsWith('src/app/') &&
        path.endsWith('.tsx') &&
        !/\.(test|spec)\.tsx$/.test(path) &&
        (componentRoot === -1 || segments.at(-1) !== 'index.tsx' || !/^[A-Z][a-zA-Z0-9]*$/.test(segments.at(-2) ?? ''))
    ) {
        findings.push({
            rule: 'name',
            level: 'error',
            message: 'UI implementations belong in components/Component/index.tsx, not flat TSX files.'
        });
    }
    if (/\.[cm]?jsx?$/.test(path) && !legacyJavaScript.has(path)) {
        findings.push({ rule: 'typescript', level: 'error', message: 'New implementation code must use TypeScript.' });
    }
    return findings;
}

export function sizeFindings(path: string, lines: number, legacy?: LegacyEntry): Finding[] {
    const policy = filePolicy(path);
    const findings: Finding[] = [];
    if (
        legacy &&
        (!Number.isInteger(legacy.maxLines) || !legacy.reason.trim() || !policy.hard || legacy.maxLines <= policy.hard)
    ) {
        return [{ rule: 'baseline', level: 'error', message: 'Invalid legacy budget or missing migration reason.' }];
    }
    if (legacy && policy.hard && lines <= policy.hard) {
        findings.push({
            rule: 'baseline',
            level: 'error',
            message: 'File now meets the hard limit; remove its obsolete legacy entry.'
        });
    }
    const ceiling = legacy?.maxLines ?? policy.hard;
    if (ceiling !== undefined && lines > ceiling) {
        findings.push({
            rule: 'file-size',
            level: 'error',
            message: `${lines} lines exceeds ${legacy ? 'legacy budget' : policy.kind + ' hard limit'} ${ceiling}; split by responsibility.`
        });
    } else if (policy.soft !== undefined && lines > policy.soft) {
        findings.push({
            rule: 'file-size',
            level: 'warning',
            message: `${lines} lines exceeds ${policy.kind} soft limit ${policy.soft}${legacy ? ' (legacy budget, no growth allowed)' : ''}; review responsibilities.`
        });
    }
    return findings;
}
