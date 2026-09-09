import { countLines, filePolicy, namingFindings, sizeFindings, sourcePattern } from './policy.ts';
import type { Finding, LegacyEntry } from './policy.ts';
import ts from 'typescript';

export function functionFindings(path: string, source: string): Finding[] {
    if (!sourcePattern.test(path) || filePolicy(path).kind === 'configuration') return [];
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const findings: Finding[] = [];

    function visit(node: ts.Node): void {
        if (
            (ts.isFunctionDeclaration(node) ||
                ts.isFunctionExpression(node) ||
                ts.isArrowFunction(node) ||
                ts.isMethodDeclaration(node) ||
                ts.isGetAccessorDeclaration(node) ||
                ts.isSetAccessorDeclaration(node) ||
                ts.isConstructorDeclaration(node)) &&
            node.body
        ) {
            const start = file.getLineAndCharacterOfPosition(node.getStart(file)).line;
            const end = file.getLineAndCharacterOfPosition(node.getEnd() - 1).line;
            if (end - start + 1 > 50) {
                findings.push({
                    rule: 'function-size',
                    level: 'warning',
                    message: `Function at line ${start + 1} spans ${end - start + 1} lines (soft limit 50); review responsibility, including JSX.`
                });
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(file);
    return findings;
}

export function uiFindings(path: string, source: string): Finding[] {
    if (!path.endsWith('.tsx')) return [];
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const findings: Finding[] = [];

    function visit(node: ts.Node): void {
        if (
            (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
            node.tagName.getText(file) === 'select'
        ) {
            const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
            findings.push({
                rule: 'ui',
                level: 'error',
                message: `Visible native <select> at line ${line} is prohibited; use the shared Dropdown component.`
            });
        }
        ts.forEachChild(node, visit);
    }

    visit(file);
    return findings;
}

export function styleFindings(path: string, source: string): Finding[] {
    if (!path.startsWith('src/') || path === 'src/app/globals.css' || !/\.(?:[cm]?tsx?|s?css)$/.test(path)) {
        return [];
    }

    const hardcodedColor = /#[\da-f]{3,8}\b|\b(?:rgb|hsl|oklch)a?\s*\(/gi;
    const match = hardcodedColor.exec(source);
    if (!match) return [];
    const line = source.slice(0, match.index).split(/\r\n|\r|\n/).length;

    return [
        {
            rule: 'styles',
            level: 'error',
            message: `Hardcoded color at line ${line}; define the value in src/app/globals.css and consume a semantic token.`
        }
    ];
}

export function inspectSource(path: string, source: string, legacy?: LegacyEntry): Finding[] {
    return [
        ...namingFindings(path),
        ...sizeFindings(path, countLines(source), legacy),
        ...functionFindings(path, source),
        ...uiFindings(path, source),
        ...styleFindings(path, source)
    ];
}
