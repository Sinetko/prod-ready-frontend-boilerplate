import { readFileSync } from 'node:fs';
import ts from 'typescript';

function importPrefix(source: ts.SourceFile, importLine: string) {
  if (!importLine) return '';
  const requested = ts.createSourceFile('import.ts', importLine, ts.ScriptTarget.Latest, true).statements[0];
  if (!requested || !ts.isImportDeclaration(requested) || !ts.isStringLiteral(requested.moduleSpecifier)) {
    throw new Error('Registry import must be a named import.');
  }
  const bindings = requested.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings) || bindings.elements.length !== 1) {
    throw new Error('Registry import must contain exactly one binding.');
  }
  const desired = bindings.elements[0];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    const named = clause?.namedBindings;
    if (
      clause?.name?.text === desired.name.text ||
      (named && ts.isNamespaceImport(named) && named.name.text === desired.name.text)
    ) {
      throw new Error(`Registry import binding already used: ${desired.name.text}`);
    }
    if (!named || !ts.isNamedImports(named)) continue;
    for (const item of named.elements) {
      if (item.name.text !== desired.name.text) continue;
      if (
        !clause?.isTypeOnly &&
        !item.isTypeOnly &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === requested.moduleSpecifier.text &&
        (item.propertyName ?? item.name).text === (desired.propertyName ?? desired.name).text
      )
        return '';
      throw new Error(`Registry import binding already used: ${desired.name.text}`);
    }
  }
  return `${importLine}\n`;
}

export function register(file: string, variable: string, key: string, expression: string, importLine = '') {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const prefix = importPrefix(ast, importLine);
  let object: ts.ObjectLiteralExpression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === variable && node.initializer) {
      let initializer = node.initializer;
      if (ts.isAsExpression(initializer)) initializer = initializer.expression;
      if (ts.isObjectLiteralExpression(initializer)) object = initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!object) throw new Error(`Cannot find ${variable} object in ${file}`);
  const properties = object.properties;
  for (const property of properties) {
    if (!ts.isPropertyAssignment(property)) throw new Error(`Unsupported registry property in ${file}`);
    const propertyKey = property.name.getText(ast).replace(/^['"]|['"]$/g, '');
    const existing = property.initializer.getText(ast);
    if (propertyKey === key) {
      if (existing.replace(/'/g, '"') !== expression.replace(/'/g, '"')) {
        throw new Error(`Registry key already used: ${key}`);
      }
      return prefix + source;
    }
    if (existing.replace(/'/g, '"') === expression.replace(/'/g, '"'))
      throw new Error(`Registry value already used: ${expression}`);
  }
  const end = object.getEnd() - 1;
  const before = source.slice(0, end).trimEnd();
  const comma = properties.length && !before.endsWith(',') ? ',' : '';
  return prefix + before + comma + `\n${JSON.stringify(key)}: ${expression},\n` + source.slice(end);
}
