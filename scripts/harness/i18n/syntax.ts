import ts from 'typescript';

export function unwrap(node: ts.Expression): ts.Expression {
    while (
        ts.isAwaitExpression(node) ||
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isTypeAssertionExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isSatisfiesExpression(node)
    ) {
        node = node.expression;
    }
    return node;
}

export function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
    callback(node);
    ts.forEachChild(node, (child) => visit(child, callback));
}

export function localProgram(path: string, source: string) {
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const options: ts.CompilerOptions = { noLib: true, noResolve: true };
    const host = ts.createCompilerHost(options);
    host.getSourceFile = (name) => (name === path ? file : undefined);
    const program = ts.createProgram([path], options, host);
    return { file, checker: program.getTypeChecker() };
}

export function factoryName(expression: ts.Expression, checker: ts.TypeChecker): string | undefined {
    const node = unwrap(expression);
    const target = ts.isPropertyAccessExpression(node) ? node.expression : node;
    const declaration = checker.getSymbolAtLocation(target)?.declarations?.[0];
    let imported: string | undefined;
    if (declaration && ts.isImportSpecifier(declaration)) {
        imported = (declaration.propertyName ?? declaration.name).text;
    } else if (declaration && ts.isNamespaceImport(declaration) && ts.isPropertyAccessExpression(node)) {
        imported = node.name.text;
    }
    if (!imported || !['useTranslations', 'getTranslations', 'createTranslator'].includes(imported)) return;
    let parent: ts.Node | undefined = declaration;
    while (parent && !ts.isImportDeclaration(parent)) parent = parent.parent;
    if (
        parent &&
        ts.isStringLiteral(parent.moduleSpecifier) &&
        ['next-intl', 'next-intl/server'].includes(parent.moduleSpecifier.text)
    )
        return imported;
}

export function factoryOptionsValid(name: string, args: ts.NodeArray<ts.Expression>): boolean {
    if (name === 'useTranslations') return args.length === 0;
    if (!args.length) return name === 'getTranslations';
    const options = unwrap(args[0]);
    if (args.length !== 1 || !ts.isObjectLiteralExpression(options)) return false;
    return options.properties.every((property) => {
        if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return false;
        if (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) return false;
        return name === 'getTranslations' ? property.name.text === 'locale' : property.name.text !== 'namespace';
    });
}
