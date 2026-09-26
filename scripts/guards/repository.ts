import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { satisfies, valid } from 'semver';
import ts from 'typescript';

import { ast, files, imports, resolveImport, sources, walk } from './source';

export function engines() {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  const issues: string[] = [];
  const pins = manifest.volta ?? {};
  const ranges = manifest.engines ?? {};
  for (const tool of new Set(['node', 'npm', ...Object.keys(pins), ...Object.keys(ranges)])) {
    if (!valid(pins[tool]) || typeof ranges[tool] !== 'string' || !satisfies(pins[tool], ranges[tool])) {
      issues.push(`package.json: engines.${tool} must accept the exact volta.${tool} pin.`);
    }
  }
  if (manifest.packageManager !== `npm@${pins.npm}`) issues.push('package.json: packageManager must match volta.npm.');
  return issues;
}
function git(args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
}
export function coverage(args: string[]) {
  if (args.length && (args.length !== 2 || args[0] !== '--base' || args[1].startsWith('-'))) {
    throw new Error('Usage: check-changed-shared-coverage [--base <revision>]');
  }
  let changed: string[];
  if (args.length) {
    const base = git(['merge-base', args[1], 'HEAD']);
    changed = git(['diff', '--name-only', '-z', '--diff-filter=ACMR', base, '--']).split('\0');
  } else {
    let head = false;
    try {
      git(['rev-parse', '--verify', 'HEAD']);
      head = true;
    } catch {
      /* Initial checkout has no HEAD. */
    }
    changed = head
      ? git(['diff', '--name-only', '-z', '--diff-filter=ACMR', 'HEAD', '--']).split('\0')
      : git(['ls-files', '-z']).split('\0');
  }
  changed.push(...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0'));
  const tests = sources().filter((file) => /\.(spec|test)\.[jt]sx?$/.test(file));
  const covered = new Set<string>();
  for (const file of tests) {
    const source = ast(file);
    let runnable = false;
    walk(source, (node) => {
      if (ts.isCallExpression(node) && /^(test|it)(\.(each|only))?$/.test(node.expression.getText(source)))
        runnable = true;
    });
    if (!runnable) continue;
    for (const entry of imports(source)) {
      if (ts.isImportTypeNode(entry.node)) continue;
      if (ts.isImportDeclaration(entry.node)) {
        const clause = entry.node.importClause;
        if (!clause || clause.isTypeOnly) continue;
        const named = clause.namedBindings;
        if (!clause.name && named && ts.isNamedImports(named) && named.elements.every((item) => item.isTypeOnly))
          continue;
      }
      const target = resolveImport(file, entry.specifier);
      if (!target) continue;
      covered.add(target);
      // Follow barrel re-exports only: importing a high-level app is not coverage for every dependency.
      const queue = [target];
      const seen = new Set<string>();
      while (queue.length) {
        const current = queue.pop()!;
        if (seen.has(current) || !/\.[jt]sx?$/.test(current)) continue;
        seen.add(current);
        for (const exported of imports(ast(current)).filter((item) => ts.isExportDeclaration(item.node))) {
          const declaration = exported.node as ts.ExportDeclaration;
          if (
            declaration.isTypeOnly ||
            (declaration.exportClause &&
              ts.isNamedExports(declaration.exportClause) &&
              declaration.exportClause.elements.every((item) => item.isTypeOnly))
          )
            continue;
          const resolved = resolveImport(current, exported.specifier);
          if (resolved) {
            covered.add(resolved);
            queue.push(resolved);
          }
        }
      }
    }
  }
  return [...new Set(changed)]
    .filter(
      (file) =>
        /^src\/(shared|business-commons)\//.test(file) &&
        /\.[jt]sx?$/.test(file) &&
        existsSync(file) &&
        !/(?:\.d\.ts|\.(?:spec|test|types|translations)\.[jt]sx?)$/.test(file) &&
        !(basename(file) === 'index.ts' && ast(file).statements.every((node) => ts.isExportDeclaration(node))) &&
        !covered.has(file)
    )
    .map((file) => `${file}: changed shared code needs an executable test importing it (directly or via a barrel).`);
}
export function icons() {
  const assets = files('src/assets/icons').filter((file) => /\.(svg|png|webp|gif|jpe?g|avif|ico)$/i.test(file));
  const referenced = new Set<string>();
  for (const file of sources()) {
    const source = ast(file);
    for (const entry of imports(source)) {
      const target = resolveImport(file, entry.specifier);
      if (target) referenced.add(target);
    }
    walk(source, (node) => {
      if (!ts.isStringLiteralLike(node)) return;
      const literal = node.text.split(/[?#]/)[0];
      for (const asset of assets) {
        if (
          literal === `/${asset}` ||
          literal === asset ||
          literal === asset.slice(4) ||
          resolveImport(file, literal) === asset
        )
          referenced.add(asset);
      }
    });
  }
  for (const file of files().filter((path) => /\.css$/.test(path))) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) {
      const target = resolveImport(`${dirname(file)}/style.ts`, match[1]);
      if (target) referenced.add(target);
    }
  }
  return assets
    .filter((file) => !referenced.has(file))
    .map((file) => `${file}: unused icon; add a static reference or remove it.`);
}
