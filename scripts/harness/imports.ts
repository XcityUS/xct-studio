import { posix } from 'node:path';
import ts from 'typescript';

export interface ModuleReference {
    specifier: string;
    runtime: boolean;
}

export function moduleReferences(path: string, source: string): ModuleReference[] {
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const references: ModuleReference[] = [];

    function visit(node: ts.Node): void {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            const clause = node.importClause;
            const bindings = clause?.namedBindings;
            const allTypes =
                bindings &&
                ts.isNamedImports(bindings) &&
                bindings.elements.length > 0 &&
                bindings.elements.every((item) => item.isTypeOnly);
            references.push({
                specifier: node.moduleSpecifier.text,
                runtime: !clause?.isTypeOnly && !(allTypes && !clause?.name)
            });
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            const clause = node.exportClause;
            const allTypes =
                clause &&
                ts.isNamedExports(clause) &&
                clause.elements.length > 0 &&
                clause.elements.every((item) => item.isTypeOnly);
            references.push({ specifier: node.moduleSpecifier.text, runtime: !node.isTypeOnly && !allTypes });
        } else if (
            ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
        ) {
            const argument = node.arguments[0];
            if (argument && ts.isStringLiteralLike(argument))
                references.push({ specifier: argument.text, runtime: true });
        } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
            const expression = node.moduleReference.expression;
            if (expression && ts.isStringLiteral(expression))
                references.push({ specifier: expression.text, runtime: !node.isTypeOnly });
        }
        ts.forEachChild(node, visit);
    }

    visit(file);
    return references;
}

export function isClientModule(path: string, source: string): boolean {
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    for (const statement of file.statements) {
        if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
        if (statement.expression.text === 'use client') return true;
    }
    return false;
}

export function resolveLocalImport(
    path: string,
    specifier: string,
    files: ReadonlyMap<string, string>
): string | undefined {
    const base = specifier.startsWith('@/')
        ? `src/${specifier.slice(2)}`
        : specifier.startsWith('.')
          ? posix.normalize(posix.join(posix.dirname(path), specifier))
          : undefined;
    if (!base) return undefined;
    return [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}/index.ts`, `${base}/index.tsx`].find(
        (candidate) => files.has(candidate)
    );
}
