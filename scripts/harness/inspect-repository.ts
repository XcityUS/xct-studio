import { isClientModule, moduleReferences, resolveLocalImport, type ModuleReference } from './imports.ts';
import { sourcePattern, type Finding } from './policy.ts';
import { posix } from 'node:path';

export interface RepositoryFinding {
    path: string;
    finding: Finding;
}

// Compatibility sources only. Removing an entry is part of its owning migration.
const legacyClients = new Set([
    'src/lib/captions.ts',
    'src/lib/image-service.ts',
    'src/lib/media-archive.ts',
    'src/lib/openai-client.ts',
    'src/lib/prompt-optimizer.ts',
    'src/lib/script-breakdown.ts',
    'src/lib/tts.ts',
    'src/lib/video-service.ts'
]);
const providerSdk = /^(?:openai|@anthropic-ai\/sdk|@google\/genai|@fal-ai\/client|@ai-sdk\/[^/]+)(?:\/|$)/;

type Report = (path: string, rule: Finding['rule'], message: string) => void;

function inspectRouting(path: string, add: Report): void {
    if (path.startsWith('src/app/') && path.endsWith('/page.tsx') && !path.startsWith('src/app/[locale]/')) {
        add(
            path,
            'ownership',
            'Keep one page implementation under app/[locale]; normalize legacy URLs through src/proxy.ts.'
        );
    }
    if (path.startsWith('src/app/[locale]/api/') || /^src\/app\/(zh|en)\//.test(path)) {
        add(path, 'ownership', 'Use the shared [locale] route tree; API routes stay in app/api outside localization.');
    }
    if (path === 'src/middleware.ts') {
        add(path, 'ownership', 'Next 16 uses src/proxy.ts; do not introduce a second middleware entry.');
    }
}

function inspectOwnership(path: string, files: ReadonlyMap<string, string>, add: Report): void {
    if (/^src\/(hooks|data|types)\//.test(path) || (path.startsWith('src/lib/') && !legacyClients.has(path))) {
        add(
            path,
            'ownership',
            'Use an owning feature, shared contract/helper, or server adapter; do not extend retired catch-all directories.'
        );
    }
    if (path.startsWith('src/components/') && !/^src\/components\/(ui|layout|providers)\//.test(path)) {
        add(
            path,
            'ownership',
            'Shared components belong under ui, layout, or providers; business UI belongs to features/<domain>/components.'
        );
    }
    if (!/\.s?css$/.test(path) || path === 'src/app/globals.css') return;
    const routeStyle = path.startsWith('src/app/') && /^[a-z-]+\.module\.scss$/.test(posix.basename(path));
    const componentStyle = path.includes('/components/') && posix.basename(path) === 'index.module.scss';
    const owner = routeStyle ? path.replace('.module.scss', '.tsx') : posix.join(posix.dirname(path), 'index.tsx');
    if ((!routeStyle && !componentStyle) || !files.has(owner)) {
        add(
            path,
            'styles',
            'Use an owned Component/index.module.scss beside index.tsx, or a matching App Router entry module.'
        );
    }
}

function inspectImport(
    path: string,
    reference: ModuleReference,
    files: ReadonlyMap<string, string>,
    add: Report
): void {
    const { specifier, runtime } = reference;
    const target = resolveLocalImport(path, specifier, files);
    if (/\.module\.s?css$/.test(specifier) && (!target || posix.dirname(target) !== posix.dirname(path))) {
        add(
            path,
            'styles',
            `Keep styles with their owner instead of importing another component's stylesheet: ${specifier}`
        );
    }
    if (/\/index(?:\.tsx?)?$/.test(specifier) && target?.endsWith('/index.tsx')) {
        add(path, 'name', `Import the component directory without /index: ${specifier}`);
    }
    if (
        runtime &&
        providerSdk.test(specifier) &&
        !path.startsWith('src/server/providers/') &&
        !legacyClients.has(path)
    ) {
        add(path, 'boundary', `Provider SDK ${specifier} belongs in a server-only provider adapter.`);
    }
    if (
        runtime &&
        target?.startsWith('src/features/') &&
        (/^src\/components\/(ui|providers)\//.test(path) || path.startsWith('src/shared/'))
    ) {
        add(
            path,
            'ownership',
            `Shared primitives, providers, and helpers must not depend on a business feature: ${specifier}`
        );
    }
}

function serverDependency(
    client: string,
    graph: ReadonlyMap<string, string[]>,
    serverModules: ReadonlySet<string>
): string | undefined {
    const pending = [client];
    const visited = new Set<string>();
    while (pending.length) {
        const path = pending.pop()!;
        if (visited.has(path)) continue;
        visited.add(path);
        if (serverModules.has(path)) return path;
        pending.push(...(graph.get(path) ?? []));
    }
}

export function inspectRepository(files: ReadonlyMap<string, string>): RepositoryFinding[] {
    const results: RepositoryFinding[] = [];
    const graph = new Map<string, string[]>();
    const serverModules = new Set<string>();
    const clientModules: string[] = [];
    const add: Report = (path, rule, message) => {
        results.push({ path, finding: { rule, level: 'error', message } });
    };

    for (const [path, source] of files) {
        if (!path.startsWith('src/')) continue;
        inspectRouting(path, add);
        inspectOwnership(path, files, add);
        if (!sourcePattern.test(path)) continue;
        const references = moduleReferences(path, source);
        const runtime = references.filter((reference) => reference.runtime);
        const guarded = runtime.some(({ specifier }) => specifier === 'server-only');
        if (guarded || path.startsWith('src/server/')) serverModules.add(path);
        if (isClientModule(path, source)) clientModules.push(path);
        if (path.startsWith('src/server/') && !path.endsWith('.d.ts') && !guarded) {
            add(
                path,
                'boundary',
                'Server implementation modules must import server-only; shared type-only contracts belong in src/shared/contracts.'
            );
        }
        graph.set(
            path,
            runtime.flatMap(({ specifier }) => {
                const target = resolveLocalImport(path, specifier, files);
                return target ? [target] : [];
            })
        );
        for (const reference of references) inspectImport(path, reference, files, add);
    }

    // Follow runtime imports/re-exports so a client barrel cannot conceal server code.
    for (const client of clientModules) {
        const dependency = serverDependency(client, graph, serverModules);
        if (dependency) add(client, 'boundary', `Client import graph reaches server-only module ${dependency}.`);
    }
    return results;
}

export function packageManagerFindings(files: ReadonlyMap<string, string>): RepositoryFinding[] {
    const errors: RepositoryFinding[] = [];
    const add = (path: string, message: string) =>
        errors.push({ path, finding: { rule: 'pnpm', level: 'error', message } });
    for (const path of ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'bun.lock', 'bun.lockb']) {
        if (files.has(path)) add(path, 'Only pnpm-lock.yaml is allowed at the application root.');
    }
    if (!files.has('pnpm-lock.yaml')) add('pnpm-lock.yaml', 'The committed pnpm lockfile is required.');
    try {
        const pkg = JSON.parse(files.get('package.json') ?? '') as {
            packageManager?: unknown;
            engines?: { pnpm?: unknown };
        };
        const pin =
            typeof pkg.packageManager === 'string' ? /^pnpm@(\d+\.\d+\.\d+)$/.exec(pkg.packageManager)?.[1] : undefined;
        if (!pin || pkg.engines?.pnpm !== pin)
            add('package.json', 'Pin an exact pnpm version and match engines.pnpm to it.');
    } catch {
        add('package.json', 'A valid package.json is required.');
    }
    return errors;
}
