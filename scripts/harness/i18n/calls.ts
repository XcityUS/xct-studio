import { isMessageKey } from './keys.ts';
import { factoryName, factoryOptionsValid, localProgram, unwrap, visit } from './syntax.ts';
import ts from 'typescript';

export function inspectTranslationCalls(path: string, source: string, keys: ReadonlySet<string>): string[] {
    if (!source.includes('next-intl')) return [];
    const { file, checker } = localProgram(path, source);
    const errors: string[] = [];
    const add = (node: ts.Node, message: string) => {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
        errors.push(`Line ${line}: ${message}`);
    };
    const translators = collectTranslators(file, checker, add);
    visit(file, (node) => inspectUsage(node, checker, translators, keys, add));
    return errors;
}

type Report = (node: ts.Node, message: string) => void;

function collectTranslators(file: ts.SourceFile, checker: ts.TypeChecker, add: Report): Set<ts.Symbol> {
    const translators = new Set<ts.Symbol>();
    visit(file, (node) => {
        inspectFactoryReference(node, checker, add);
        if (!ts.isCallExpression(node)) return;
        const name = factoryName(node.expression, checker);
        if (!name) return;
        if (!factoryOptionsValid(name, node.arguments))
            add(node, 'Use a root translator with explicit options and no namespace.');
        let parent: ts.Node = node;
        while (parent.parent && ts.isExpression(parent.parent) && unwrap(parent.parent) === node)
            parent = parent.parent;
        if (!ts.isVariableDeclaration(parent.parent) || !ts.isIdentifier(parent.parent.name)) {
            add(node, 'Bind the root translator directly to a local const before calling it.');
            return;
        }
        const symbol = checker.getSymbolAtLocation(parent.parent.name);
        if (symbol) translators.add(symbol);
    });
    return translators;
}

function inspectUsage(
    node: ts.Node,
    checker: ts.TypeChecker,
    translators: ReadonlySet<ts.Symbol>,
    keys: ReadonlySet<string>,
    add: Report
): void {
    if (!ts.isIdentifier(node)) return;
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol || !translators.has(symbol)) return;
    if (ts.isVariableDeclaration(node.parent) && node.parent.name === node) return;
    let callee: ts.Node = node;
    if (
        ts.isPropertyAccessExpression(node.parent) &&
        node.parent.expression === node &&
        ['rich', 'raw', 'markup', 'has'].includes(node.parent.name.text)
    )
        callee = node.parent;
    if (!ts.isCallExpression(callee.parent) || callee.parent.expression !== callee) {
        add(node, 'Call the local translator directly; do not alias, destructure, or pass it to another function.');
        return;
    }
    const key = callee.parent.arguments[0];
    if (!key || (!ts.isStringLiteral(key) && !ts.isNoSubstitutionTemplateLiteral(key))) {
        add(
            callee,
            'Translation keys must be static literals, never variables, concatenation, or template interpolation.'
        );
    } else if (!isMessageKey(key.text)) {
        add(key, `Use a normalized flat English message key: ${key.text}`);
    } else if (!keys.has(key.text)) {
        add(key, `Message is missing from en.json: ${key.text}`);
    }
}

function inspectFactoryReference(node: ts.Node, checker: ts.TypeChecker, add: Report): void {
    if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        ['next-intl', 'next-intl/server'].includes(node.moduleSpecifier.text)
    ) {
        const exports = node.exportClause;
        if (
            !exports ||
            !ts.isNamedExports(exports) ||
            exports.elements.some((entry) =>
                ['useTranslations', 'getTranslations', 'createTranslator'].includes(
                    (entry.propertyName ?? entry.name).text
                )
            )
        ) {
            add(node, 'Import translation factories directly from next-intl; do not re-export them.');
        }
    }
    if ((!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) || ts.isImportSpecifier(node.parent)) return;
    if (ts.isPropertyAccessExpression(node.parent)) return;
    if (!factoryName(node, checker)) return;
    if (!ts.isCallExpression(node.parent) || node.parent.expression !== node) {
        add(node, 'Call translation factories directly; do not alias or pass them to wrappers.');
    }
}
