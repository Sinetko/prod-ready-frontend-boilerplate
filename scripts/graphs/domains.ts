import { existsSync, readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import ts from 'typescript';

import { Kind as GraphqlKind, parse, visit } from 'graphql';

import type { analyze } from './analyze';
import { localPath } from './inventory';

export function domains(context: ReturnType<typeof analyze>, files: string[]) {
  const { graphs, asts, checker, add, walk, diagnostics } = context;
  function value(node: ts.Node | undefined, seen = new Set<ts.Node>()): ts.Node | undefined {
    if (!node || seen.has(node)) return undefined;
    seen.add(node);
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))
      return value(node.expression, seen);
    if (!ts.isIdentifier(node)) return node;
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags === ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.valueDeclaration;
    return declaration && ts.isVariableDeclaration(declaration) ? value(declaration.initializer, seen) : undefined;
  }
  function properties(node: ts.Node | undefined) {
    const object = value(node);
    if (!object || !ts.isObjectLiteralExpression(object)) return [];
    return object.properties.flatMap((property) => {
      if (ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name))
        return [{ name: property.name.getText().replace(/^['"]|['"]$/g, ''), value: property.initializer }];
      if (ts.isShorthandPropertyAssignment(property)) {
        const symbol = checker.getShorthandAssignmentValueSymbol(property);
        let original = symbol;
        if (original?.flags === ts.SymbolFlags.Alias) original = checker.getAliasedSymbol(original);
        const declaration = original?.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer)
          return [{ name: property.name.text, value: declaration.initializer }];
      }
      return [];
    });
  }
  const namespaces = new Map<string, ts.Node>();
  for (const source of asts)
    walk(source, (node) => {
      if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) return;
      const file = localPath(source.fileName);
      if (file === 'src/core/routing/routing.model.ts' && node.name.text === 'routePaths')
        for (const property of properties(node.initializer)) {
          const route = value(property.value);
          if (route && ts.isStringLiteralLike(route))
            add('routes', route, 'route', property.name, route.text, property.name);
        }
      if (file === 'src/bootstrap/namespace-map.ts' && node.name.text === 'namespaceMap')
        for (const property of properties(node.initializer)) namespaces.set(property.name, property.value);
    });
  function translationKeys(namespace: string, node: ts.Node, prefix = '', seen = new Set<ts.Node>()) {
    const resolved = value(node);
    if (!resolved || seen.has(resolved)) return;
    const ancestors = new Set(seen).add(resolved);
    for (const property of properties(resolved)) {
      const key = `${prefix}${property.name}`;
      const leaf = value(property.value);
      if (leaf && ts.isStringLiteralLike(leaf))
        add('translations', leaf, 'defines', namespace, `${namespace}:${key}`, key, leaf.text);
      else translationKeys(namespace, property.value, `${key}.`, ancestors);
    }
  }
  for (const [namespace, node] of namespaces) translationKeys(namespace, node);
  const operations = new Set<string>();
  function graphql(text: string, file: string, offset = 0) {
    try {
      const document = parse(text);
      for (const definition of document.definitions) {
        if (definition.kind !== GraphqlKind.OPERATION_DEFINITION && definition.kind !== GraphqlKind.FRAGMENT_DEFINITION)
          continue;
        const name = definition.name?.value;
        if (!name) {
          diagnostics.push(`${file}: anonymous GraphQL document cannot be indexed by name`);
          continue;
        }
        operations.add(name);
        const line = offset + text.slice(0, definition.loc?.start ?? 0).split('\n').length;
        graphs['graphql-operations'].push({
          relation: definition.kind === GraphqlKind.FRAGMENT_DEFINITION ? 'fragment' : definition.operation,
          from: file,
          to: name,
          path: file,
          line,
          name,
        });
        visit(definition, {
          FragmentSpread(node) {
            graphs['graphql-operations'].push({
              relation: 'spreads',
              from: name,
              to: node.name.value,
              path: file,
              line: offset + text.slice(0, node.loc?.start ?? 0).split('\n').length,
              name: node.name.value,
            });
          },
        });
      }
    } catch (error) {
      diagnostics.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const file of files.filter((path) => /^src\/graphql\/(queries|mutations|fragments)\/.*\.graphql$/.test(path)))
    graphql(readFileSync(file, 'utf8'), file);
  for (const source of asts)
    walk(source, (node) => {
      if (ts.isTaggedTemplateExpression(node) && node.tag.getText() === 'gql') {
        if (ts.isNoSubstitutionTemplateLiteral(node.template))
          graphql(
            node.template.text,
            localPath(source.fileName),
            source.getLineAndCharacterOfPosition(node.template.getStart() + 1).line
          );
        else
          diagnostics.push(`${localPath(source.fileName)}: interpolated GraphQL template is not statically indexable`);
      }
    });
  for (const source of asts) {
    const file = localPath(source.fileName);
    const bindings = new Map<ts.Symbol, { namespace: string; prefix: string }>();
    walk(source, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isObjectBindingPattern(node.name)
      ) {
        const call = node.initializer;
        let symbol = checker.getSymbolAtLocation(call.expression);
        if (symbol?.flags === ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
        if (symbol?.name !== 'useTranslation') return;
        const namespace = call.arguments[0];
        if (!namespace || !ts.isStringLiteralLike(namespace)) return;
        const prefixNode = properties(call.arguments[1]).find((property) => property.name === 'keyPrefix')?.value;
        const prefixValue = value(prefixNode);
        const prefix = prefixValue && ts.isStringLiteralLike(prefixValue) ? prefixValue.text : '';
        for (const binding of node.name.elements) {
          if ((binding.propertyName ?? binding.name).getText() !== 't') continue;
          const bound = checker.getSymbolAtLocation(binding.name);
          if (bound) bindings.set(bound, { namespace: namespace.text, prefix });
        }
        add('translations', call, 'uses-namespace', file, namespace.text, namespace.text);
      }
    });
    walk(source, (node) => {
      if (ts.isIdentifier(node)) {
        let symbol = checker.getSymbolAtLocation(node);
        if (symbol?.flags === ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
        const name = symbol?.name;
        if (
          name?.endsWith('Document') &&
          operations.has(name.slice(0, -8)) &&
          symbol?.declarations?.some(
            (declaration) => localPath(declaration.getSourceFile().fileName) === 'src/graphql/graphql-api-types.ts'
          )
        )
          add('graphql-usage', node, 'document-reference', file, name.slice(0, -8), name.slice(0, -8));
      }
      if (!ts.isCallExpression(node)) return;
      const bound = checker.getSymbolAtLocation(node.expression);
      const binding = bound && bindings.get(bound);
      const argument = node.arguments[0];
      if (binding && argument) {
        const overrideNode = properties(node.arguments[1]).find((property) => property.name === 'ns')?.value;
        const override = value(overrideNode);
        const namespace = override && ts.isStringLiteralLike(override) ? override.text : binding.namespace;
        const candidates = ts.isConditionalExpression(argument) ? [argument.whenTrue, argument.whenFalse] : [argument];
        for (const candidate of candidates)
          if (ts.isStringLiteralLike(candidate)) {
            const split = candidate.text.indexOf(':');
            const selected = split < 0 ? namespace : candidate.text.slice(0, split);
            const key = split < 0 ? candidate.text : candidate.text.slice(split + 1);
            const full = binding.prefix ? `${binding.prefix}.${key}` : key;
            add('translations', candidate, 'uses-key', file, `${selected}:${full}`, candidate.text);
          }
      }
      // Candidates only: no claim that an arbitrary .emit/.track call is a configured analytics backend.
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        /^(emit|track)$/.test(node.expression.name.text) &&
        argument &&
        ts.isStringLiteralLike(argument)
      )
        add('analytics-events', node, 'emits-candidate', file, argument.text, argument.text, node.expression.getText());
    });
  }
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
    graphs['build-pipeline'].push({
      relation: 'script',
      from: 'package.json',
      to: `script:${name}`,
      path: 'package.json',
      line: 1,
      name,
      detail: String(command),
    });
    for (const match of String(command).matchAll(/(?:npm run\s+|run-s\s+)([\w:-]+)/g))
      graphs['build-pipeline'].push({
        relation: 'runs',
        from: `script:${name}`,
        to: `script:${match[1]}`,
        path: 'package.json',
        line: 1,
        name,
      });
    for (const file of files.filter((path) => path.startsWith('scripts/') && String(command).includes(path)))
      graphs['build-pipeline'].push({
        relation: 'executes',
        from: `script:${name}`,
        to: file,
        path: 'package.json',
        line: 1,
        name,
      });
  }
  for (const file of files.filter((path) => /(?:config\.|^\.[^/]+rc|^codegen\.yml|^\.swcrc)/.test(path)))
    graphs['build-pipeline'].push({
      relation: 'config',
      from: 'repository',
      to: file,
      path: file,
      line: 1,
      name: file,
    });
  if (existsSync('docs/units.map.json')) {
    const units: unknown = JSON.parse(readFileSync('docs/units.map.json', 'utf8'));
    if (!Array.isArray(units)) throw new Error('docs/units.map.json must contain an array');
    const memberships = new Map<string, string[]>();
    for (const unit of units) {
      if (
        !unit ||
        typeof unit.id !== 'string' ||
        !unit.id ||
        memberships.has(unit.id) ||
        !Array.isArray(unit.globs) ||
        !unit.globs.every((glob: unknown) => typeof glob === 'string')
      )
        throw new Error('Invalid doc unit');
      const members = files.filter((file) => unit.globs.some((glob: string) => matchesGlob(file, glob)));
      memberships.set(unit.id, members);
      for (const file of members)
        graphs['unit-edges'].push({
          relation: 'contains',
          from: unit.id,
          to: file,
          path: 'docs/units.map.json',
          line: 1,
          name: unit.id,
        });
    }
    for (const edge of graphs.imports.filter((entry) => entry.relation === 'imports'))
      for (const [from, members] of memberships)
        if (members.includes(edge.from))
          for (const [to, targets] of memberships)
            if (from !== to && targets.includes(edge.to))
              graphs['unit-edges'].push({ ...edge, relation: 'depends-on-unit', from, to, name: from });
  }
}
