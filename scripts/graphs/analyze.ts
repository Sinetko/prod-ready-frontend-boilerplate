import { existsSync, readFileSync, statSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

import { handwritten, localPath } from './inventory';
import { kinds } from './model';
import type { Kind, RecordEntry } from './model';

export function analyze(files: string[]) {
  const graphs = Object.fromEntries(kinds.map((kind) => [kind, [] as RecordEntry[]])) as Record<Kind, RecordEntry[]>;
  const diagnostics: string[] = [];
  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  if (parsed.errors.length) throw new Error(parsed.errors.map((error) => error.messageText).join('\n'));
  const sources = files.filter(handwritten);
  const program = ts.createProgram(
    sources.map((file) => resolve(file)),
    { ...parsed.options, allowJs: true }
  );
  for (const error of program.getSyntacticDiagnostics()) {
    const message = ts.flattenDiagnosticMessageText(error.messageText, '\n');
    diagnostics.push(`${error.file ? localPath(error.file.fileName) : 'TypeScript'}: ${message}`);
  }
  const checker = program.getTypeChecker();
  const definitions = new Map<ts.Declaration, { id: string; name: string; path: string }>();
  function location(node: ts.Node) {
    const source = node.getSourceFile();
    return { path: localPath(source.fileName), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 };
  }
  function add(kind: Kind, node: ts.Node, relation: string, from: string, to: string, name?: string, detail?: string) {
    graphs[kind].push({
      relation,
      from,
      to,
      ...location(node),
      ...(name ? { name } : {}),
      ...(detail ? { detail } : {}),
    });
  }
  function walk(node: ts.Node, visit: (child: ts.Node) => void) {
    visit(node);
    node.forEachChild((child) => walk(child, visit));
  }
  function target(node: ts.Node) {
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags === ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol?.declarations?.map((declaration) => definitions.get(declaration)).find(Boolean);
  }
  function owner(node: ts.Node): string {
    let parent: ts.Node | undefined = node.parent;
    while (parent) {
      const entry = definitions.get(parent as ts.Declaration);
      if (entry) return entry.id;
      parent = parent.parent;
    }
    return location(node).path;
  }
  const asts = sources
    .map((file) => program.getSourceFile(resolve(file)))
    .filter((file): file is ts.SourceFile => !!file);
  for (const source of asts)
    walk(source, (node) => {
      if (
        !ts.isFunctionDeclaration(node) &&
        !ts.isVariableDeclaration(node) &&
        !ts.isClassDeclaration(node) &&
        !ts.isInterfaceDeclaration(node) &&
        !ts.isTypeAliasDeclaration(node) &&
        !ts.isEnumDeclaration(node)
      )
        return;
      if (!node.name || !ts.isIdentifier(node.name)) return;
      const { path, line } = location(node);
      const name = node.name.text;
      const id = `${path}#${name}@${node.getStart()}`;
      definitions.set(node, { id, name, path });
      const entry = { relation: 'defines', from: path, to: id, path, line, name };
      graphs.symbols.push(entry);
      if (/\.component\.[jt]sx?$|\.page\.[jt]sx?$/.test(path) && /^[A-Z]/.test(name))
        graphs['symbols.components'].push(entry);
      if (/^use[A-Z]/.test(name)) graphs['symbols.hooks'].push(entry);
      if (/\/utils\//.test(path)) graphs['symbols.utils'].push(entry);
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node))
        graphs['symbols.types'].push(entry);
      if (/^src\/graphql\//.test(path)) graphs['symbols.graphql'].push(entry);
      if (!ts.isExternalModule(source) || /\.d\.ts$/.test(path)) graphs.globals.push(entry);
    });
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  const packages = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  for (const source of asts) {
    const file = localPath(source.fileName);
    const feature = /^src\/features\/([^/]+)/.exec(file)?.[1];
    if (feature) add('features', source, 'contains', feature, file, feature);
    walk(source, (node) => {
      let specifier: ts.Expression | undefined;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
      if (ts.isCallExpression(node) && /^(import|require)$/.test(node.expression.getText())) {
        specifier = node.arguments[0];
        if (!specifier || !ts.isStringLiteralLike(specifier))
          add('imports', node, 'dynamic-import', file, '<dynamic>', undefined, node.getText().slice(0, 160));
      }
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const name = specifier.text;
        const clean = name.split('?')[0];
        const found = ts.resolveModuleName(clean, resolve(file), parsed.options, ts.sys).resolvedModule;
        const candidate = clean.startsWith('.') ? resolve(dirname(file), clean) : resolve('src', clean);
        const packageName = clean.startsWith('@') ? clean.split('/').slice(0, 2).join('/') : clean.split('/')[0];
        const external = found?.isExternalLibraryImport || isBuiltin(clean) || packages.has(packageName);
        const path =
          found && !found.isExternalLibraryImport
            ? localPath(found.resolvedFileName)
            : existsSync(candidate) && statSync(candidate).isFile()
              ? localPath(candidate)
              : undefined;
        if (!path && !external) diagnostics.push(`${file}:${location(node).line}: unresolved local import ${name}`);
        const destination = path ?? `package:${name}`;
        add(
          'imports',
          node,
          path ? 'imports' : external ? 'external-import' : 'unresolved-import',
          file,
          destination,
          name
        );
        if (path) add('dependents', node, 'dependent', destination, file, name);
        if (path?.startsWith('src/graphql/')) add('graphql-usage', node, 'imports', file, path, name);
        if (/^(src\/vite\/|vite\.config\.)/.test(file)) add('build-pipeline', node, 'imports', file, destination, name);
      }
      if (ts.isIdentifier(node)) {
        const definition = target(node);
        if (definition) {
          const declarationName = (node.parent as ts.NamedDeclaration).name;
          if (declarationName === node && definitions.has(node.parent as ts.Declaration)) return;
          add('references', node, 'references', owner(node), definition.id, definition.name);
          if (definition.path.startsWith('src/graphql/'))
            add('graphql-usage', node, 'references', file, definition.id, definition.name);
        }
      }
      if (ts.isCallExpression(node)) {
        const expression = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
        const definition = target(expression);
        if (definition) add('data-flow', node, 'calls', owner(node), definition.id, definition.name);
      }
      if (ts.isVariableDeclaration(node) && node.initializer && definitions.has(node)) {
        const destination = definitions.get(node)!;
        walk(node.initializer, (child) => {
          if (!ts.isIdentifier(child)) return;
          const definition = target(child);
          if (definition && definition.id !== destination.id)
            add('data-flow', child, 'initializer-reads', destination.id, definition.id, definition.name);
        });
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName;
        const definition = target(ts.isPropertyAccessExpression(tag) ? tag.name : tag);
        if (definition) add('render-flow', node, 'renders', owner(node), definition.id, definition.name);
      }
      if (ts.isModuleDeclaration(node) && (node.name.getText() === 'global' || ts.isStringLiteral(node.name)))
        add('globals', node, 'augments', file, node.name.getText(), node.name.getText());
    });
  }
  return { graphs, diagnostics, asts, checker, add, walk };
}
