import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

export function files(directory = 'src'): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
  });
}
export function sources() {
  return files().filter((file) => /\.[cm]?[jt]sx?$/.test(file) && !file.endsWith('/graphql-api-types.ts'));
}
export function ast(file: string) {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}
export function walk(node: ts.Node, visit: (child: ts.Node) => void) {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}
export function strings(node: ts.Node | undefined): string[] {
  if (!node) return [];
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isConditionalExpression(node)) {
    const yes = strings(node.whenTrue);
    const no = strings(node.whenFalse);
    return yes.length && no.length ? [...yes, ...no] : [];
  }
  return [];
}
export function imports(source: ts.SourceFile) {
  const result: { specifier: string; node: ts.Node }[] = [];
  walk(source, (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      for (const specifier of strings(node.moduleSpecifier)) result.push({ specifier, node });
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      for (const specifier of strings(node.argument.literal)) result.push({ specifier, node });
    }
    if (ts.isCallExpression(node) && /^(import|require)$/.test(node.expression.getText(source))) {
      for (const specifier of strings(node.arguments[0])) result.push({ specifier, node });
    }
  });
  return result;
}
export function resolveImport(file: string, specifier: string) {
  const clean = specifier.split('?')[0];
  const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(configFile.config ?? {}, ts.sys, process.cwd());
  const found = ts.resolveModuleName(clean, resolve(file), config.options, ts.sys).resolvedModule;
  if (found && !found.isExternalLibraryImport) return relative(process.cwd(), found.resolvedFileName);
  const candidate = specifier.startsWith('.') ? resolve(dirname(file), clean) : resolve('src', clean);
  if (existsSync(candidate)) return relative(process.cwd(), candidate);
  return undefined;
}
export function report(issues: string[]) {
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else console.log('Guard passed.');
}
