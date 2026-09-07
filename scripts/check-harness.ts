import { inspectI18n } from './harness/inspect-i18n.ts';
import { inspectRepository, packageManagerFindings } from './harness/inspect-repository.ts';
import { inspectSource } from './harness/inspect-source.ts';
import { inspectedPattern, scanRoots } from './harness/policy.ts';
import type { Finding, LegacyBaseline } from './harness/policy.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const baselinePath = 'docs/harness/file-size-baseline.json';
const baseline: LegacyBaseline = JSON.parse(readFileSync(resolve(root, baselinePath), 'utf8'));

function listFiles(directory: string): string[] {
    return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
        const path = `${directory}/${entry.name}`;
        if (entry.isSymbolicLink()) throw new Error(`Harness does not follow symlinks: ${path}`);
        if (entry.isDirectory()) return listFiles(path);
        return inspectedPattern.test(path) ? [path] : [];
    });
}

const files = scanRoots.flatMap(listFiles).sort();
const results: { path: string; finding: Finding }[] = [];
const sources = new Map<string, string>();
for (const path of files) {
    const source = readFileSync(resolve(root, path), 'utf8');
    sources.set(path, source);
    for (const finding of inspectSource(path, source, baseline[path])) {
        results.push({ path, finding });
    }
}
for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (
        entry.isFile() &&
        (entry.name === 'package.json' ||
            /^(?:pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?)$/.test(entry.name))
    ) {
        sources.set(entry.name, readFileSync(resolve(root, entry.name), 'utf8'));
    }
}
results.push(...inspectRepository(sources), ...packageManagerFindings(sources), ...inspectI18n(sources));
for (const path of Object.keys(baseline)) {
    if (!files.includes(path)) {
        results.push({
            path,
            finding: { rule: 'baseline', level: 'error', message: 'Remove stale baseline entry for missing file.' }
        });
    }
}

const errors = results.filter(({ finding }) => finding.level === 'error');
const warnings = results.filter(({ finding }) => finding.level === 'warning');
const shownWarnings = process.argv.includes('--verbose') ? warnings : warnings.slice(0, 12);
for (const { path, finding } of [...errors, ...shownWarnings]) {
    console.log(`${finding.level.toUpperCase()} ${path} [${finding.rule}]: ${finding.message}`);
}
if (warnings.length > shownWarnings.length) {
    console.log(
        `${warnings.length - shownWarnings.length} additional warnings; use pnpm check:harness --verbose to inspect.`
    );
}
console.log(
    `Harness: ${files.length} files, ${errors.length} errors, ${warnings.length} warnings, ${Object.keys(baseline).length} legacy size budgets.`
);
process.exitCode = errors.length ? 1 : 0;
