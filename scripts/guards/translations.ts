import { resolve } from 'node:path';
import ts from 'typescript';

import { sources, strings, walk } from './source';

export function translations() {
  const issues: string[] = [];
  const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(configFile.config ?? {}, ts.sys, process.cwd());
  const program = ts.createProgram(
    sources().map((file) => resolve(file)),
    config.options
  );
  const checker = program.getTypeChecker();
  function value(node: ts.Node | undefined, seen = new Set<ts.Node>()): ts.Node | undefined {
    if (!node || seen.has(node)) return undefined;
    seen.add(node);
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))
      return value(node.expression, seen);
    if (!ts.isIdentifier(node)) return node;
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol && symbol.flags === ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.valueDeclaration;
    return declaration && ts.isVariableDeclaration(declaration) ? value(declaration.initializer, seen) : undefined;
  }
  function properties(node: ts.Node | undefined, label: string) {
    const object = value(node);
    const result = new Map<string, ts.Expression>();
    if (!object || !ts.isObjectLiteralExpression(object)) {
      issues.push(`${label}: translation resources must be statically resolvable objects.`);
      return result;
    }
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) {
        issues.push(`${label}: use explicit translation properties; spreads/computed keys are not supported.`);
        continue;
      }
      const name =
        ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
          ? property.name.text
          : property.name.getText();
      if (result.has(name)) issues.push(`${label}: duplicate translation key ${name}.`);
      result.set(name, property.initializer);
    }
    return result;
  }
  function keys(node: ts.Node, label: string, prefix = '', ancestors = new Set<ts.Node>()): Set<string> {
    const resolved = value(node);
    if (!resolved || ancestors.has(resolved)) {
      issues.push(`${label}: cyclic or unresolved translation resource.`);
      return new Set();
    }
    const next = new Set(ancestors).add(resolved);
    const result = new Set<string>();
    for (const [key, child] of properties(resolved, label)) {
      const path = `${prefix}${key}`;
      const leaf = value(child);
      if (leaf && ts.isStringLiteralLike(leaf)) result.add(path);
      else if (leaf && ts.isObjectLiteralExpression(leaf))
        for (const nested of keys(leaf, label, `${path}.`, next)) result.add(nested);
      else issues.push(`${label}: ${path} must be a string or nested translation object.`);
    }
    return result;
  }
  const namespaces = new Map<string, Set<string>>();
  for (const source of program
    .getSourceFiles()
    .filter((file) => /\/src\/|^src\//.test(file.fileName) && !file.isDeclarationFile)) {
    if (source.fileName.endsWith('.translations.ts')) {
      for (const statement of source.statements)
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations)
            if (declaration.initializer) keys(declaration.initializer, source.fileName);
        }
    }
    if (source.fileName.endsWith('/bootstrap/namespace-map.ts'))
      walk(source, (node) => {
        if (ts.isVariableDeclaration(node) && node.name.getText() === 'namespaceMap') {
          for (const [namespace, resource] of properties(node.initializer, source.fileName))
            namespaces.set(namespace, keys(resource, namespace));
        }
      });
  }
  if (!namespaces.size) issues.push('src/bootstrap/namespace-map.ts: missing or empty namespaceMap.');
  for (const file of sources().filter((path) => !/\.(spec|test)\./.test(path))) {
    const source = program.getSourceFile(resolve(file));
    if (!source) continue;
    const bindings = new Map<ts.Symbol, { namespace: string; prefix: string }>();
    const hooks = new Set<ts.Symbol>();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== 'react-i18next'
      )
        continue;
      const named = statement.importClause?.namedBindings;
      if (named && ts.isNamedImports(named))
        for (const item of named.elements) {
          if ((item.propertyName ?? item.name).text === 'useTranslation') {
            const symbol = checker.getSymbolAtLocation(item.name);
            if (symbol) hooks.add(symbol);
          }
        }
    }
    walk(source, (node) => {
      if (!ts.isVariableDeclaration(node) || !node.initializer || !ts.isCallExpression(node.initializer)) return;
      const call = node.initializer;
      const symbol = checker.getSymbolAtLocation(call.expression);
      if (!symbol || !hooks.has(symbol)) return;
      const argument = call.arguments[0];
      const namespace = argument && ts.isStringLiteralLike(argument) ? argument.text : '';
      if (!ts.isObjectBindingPattern(node.name))
        issues.push(`${file}: destructure t from useTranslation for static validation.`);
      if (!namespace || !namespaces.has(namespace))
        issues.push(`${file}: useTranslation requires one registered literal namespace.`);
      let prefix = '';
      const options = call.arguments[1];
      if (options && ts.isObjectLiteralExpression(options))
        for (const property of options.properties) {
          if (ts.isPropertyAssignment(property) && property.name.getText() === 'keyPrefix') {
            if (!ts.isStringLiteralLike(property.initializer)) issues.push(`${file}: keyPrefix must be a literal.`);
            prefix = strings(property.initializer)[0] ?? '';
          }
        }
      if (ts.isObjectBindingPattern(node.name))
        for (const binding of node.name.elements) {
          if ((binding.propertyName ?? binding.name).getText() !== 't') continue;
          const bindingSymbol = checker.getSymbolAtLocation(binding.name);
          if (bindingSymbol) bindings.set(bindingSymbol, { namespace, prefix });
        }
    });
    walk(source, (node) => {
      if (!ts.isCallExpression(node)) return;
      const symbol = checker.getSymbolAtLocation(node.expression);
      const binding = symbol && bindings.get(symbol);
      if (!binding) return;
      const candidates = strings(node.arguments[0]);
      if (!candidates.length) issues.push(`${file}: translation keys must be literals or conditional literals.`);
      let override: string | undefined;
      const options = node.arguments[1];
      if (options && ts.isObjectLiteralExpression(options))
        for (const property of options.properties) {
          if (ts.isPropertyAssignment(property) && property.name.getText() === 'ns') {
            if (!ts.isStringLiteralLike(property.initializer)) issues.push(`${file}: ns override must be a literal.`);
            override = strings(property.initializer)[0];
          }
        }
      for (const candidate of candidates) {
        const split = candidate.indexOf(':');
        const namespace = split < 0 ? (override ?? binding.namespace) : candidate.slice(0, split);
        const key = split < 0 ? candidate : candidate.slice(split + 1);
        const full = binding.prefix ? `${binding.prefix}.${key}` : key;
        if (!namespaces.get(namespace)?.has(full)) issues.push(`${file}: missing translation ${namespace}:${full}.`);
      }
    });
  }
  return [...new Set(issues)];
}
