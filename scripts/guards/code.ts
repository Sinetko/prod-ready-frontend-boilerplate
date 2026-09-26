import { dirname } from 'node:path';
import ts from 'typescript';

import { ast, imports, resolveImport, sources, walk } from './source';

// A layer can always import itself. Features additionally stay within their own domain.
const low = ['assets', 'types'];
const generic = [...low, 'shared', 'theme'];
const domain = [...generic, 'graphql', 'business-commons'];
const shell = [...domain, 'core', 'templates'];
const allowed: Record<string, string[]> = {
  assets: [],
  types: [],
  shared: low,
  theme: [...low, 'shared'],
  graphql: generic,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Established layer directory.
  'business-commons': [...generic, 'graphql'],
  core: domain,
  templates: [...domain, 'core'],
  features: shell,
  bootstrap: [...shell, 'features'],
  app: [...shell, 'features', 'bootstrap'],
  vite: [],
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Established layer directory.
  __mocks__: [...shell, 'features', 'bootstrap', 'app'],
};
export function boundaries() {
  const issues: string[] = [];
  for (const file of sources()) {
    if (/\.(spec|test)\.[jt]sx?$/.test(file)) continue;
    const from = file.split('/')[1];
    for (const { specifier } of imports(ast(file))) {
      const target = resolveImport(file, specifier);
      if (!target?.startsWith('src/')) continue;
      // i18next's ambient augmentation derives namespace types from the composition registry.
      if (file === 'src/types/i18next.d.ts' && target === 'src/bootstrap/namespace-map.ts') continue;
      const to = target.split('/')[1];
      const crossFeature = from === 'features' && to === from && file.split('/')[2] !== target.split('/')[2];
      if (crossFeature || (from !== to && !allowed[from]?.includes(to))) {
        issues.push(`${file}: forbidden ${from} -> ${to} import (${specifier}).`);
      }
    }
  }
  return issues;
}
export function apollo() {
  const issues: string[] = [];
  const raw = new Set([
    'useQuery',
    'useLazyQuery',
    'useMutation',
    'useSubscription',
    'useSuspenseQuery',
    'useBackgroundQuery',
    'useReadQuery',
    'useLoadableQuery',
    'useQueryRefHandlers',
    'useSuspenseFragment',
    'useFragment',
  ]);
  for (const file of sources()) {
    const source = ast(file);
    const wrapper = /^src\/graphql\/hooks\/use-apollo-(query|lazy-query|mutation)\/use-apollo-\1\.hook\.ts$/.exec(file);
    const permitted = wrapper
      ? new Map([
          ['query', 'useQuery'],
          ['lazy-query', 'useLazyQuery'],
          ['mutation', 'useMutation'],
        ]).get(wrapper[1])
      : '';
    for (const { specifier, node } of imports(source)) {
      if (!/^@apollo\/client(?:\/|$)/.test(specifier)) continue;
      if (ts.isImportTypeNode(node)) continue;
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (!clause || clause.isTypeOnly) continue;
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const item of bindings.elements) {
            const name = (item.propertyName ?? item.name).text;
            if (!item.isTypeOnly && raw.has(name) && name !== permitted) {
              issues.push(`${file}: use the project wrapper instead of ${name}.`);
            }
          }
          if (!clause.name) continue;
        }
      } else if (ts.isExportDeclaration(node)) {
        if (node.isTypeOnly) continue;
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const item of node.exportClause.elements) {
            if (!item.isTypeOnly && raw.has((item.propertyName ?? item.name).text)) {
              issues.push(`${file}: raw Apollo hook re-export is forbidden.`);
            }
          }
          continue;
        }
      }
      issues.push(`${file}: Apollo namespace/default/star/dynamic imports are forbidden; use named imports.`);
    }
  }
  return issues;
}
export function hookNames() {
  const issues: string[] = [];
  for (const file of sources().filter(
    (path) => /^src\/graphql\/(queries|mutations)\//.test(path) && path.endsWith('.hook.ts')
  )) {
    const name = dirname(file).split('/').pop()!;
    const pascal = name
      .split('-')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join('');
    const source = ast(file);
    const hooks: string[] = [];
    walk(source, (node) => {
      if (
        (ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        if (ts.isFunctionDeclaration(node) && node.name) hooks.push(node.name.text);
        if (ts.isVariableStatement(node))
          for (const declaration of node.declarationList.declarations) hooks.push(declaration.name.getText(source));
      }
    });
    const suffixes = file.includes('/mutations/') ? ['Mutation'] : ['Query', 'LazyQuery'];
    const expected = suffixes.map((suffix) => `use${pascal}${suffix}`);
    if (hooks.length !== 1 || !expected.includes(hooks[0]))
      issues.push(`${file}: export exactly one hook named ${expected.join(' or ')}.`);
  }
  return issues;
}
