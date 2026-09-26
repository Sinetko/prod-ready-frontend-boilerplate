import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const excluded = new Set([
  'node_modules',
  '.git',
  '.pnpm-store',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
]);
function eligible(file: string) {
  return (
    !file.split('/').some((part) => excluded.has(part)) &&
    !/^\.claude\/(cache|context-graphs)\//.test(file) &&
    !/\.(tsbuildinfo|log)$/.test(file) &&
    !file.endsWith('.eslintcache')
  );
}
function scan(root = '.'): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name).replaceAll('\\', '/');
    if (!eligible(path) || entry.isSymbolicLink()) return [];
    return entry.isDirectory() ? scan(path) : entry.isFile() ? [path] : [];
  });
}
export function inventory() {
  let paths: string[];
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (resolve(root.trim()) !== process.cwd()) throw new Error('Not repository root');
    paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    }).split('\0');
  } catch {
    paths = scan();
  }
  return [...new Set(paths)]
    .filter((file) => file && eligible(file) && existsSync(file) && lstatSync(file).isFile())
    .sort();
}
export function digest(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
export function fingerprint(files: string[]) {
  const hash = createHash('sha256');
  for (const file of files)
    hash
      .update(file)
      .update('\0')
      .update(digest(readFileSync(file)))
      .update('\0');
  return hash.digest('hex');
}
export function localPath(file: string) {
  return relative(process.cwd(), resolve(file)).replaceAll('\\', '/');
}
export function handwritten(file: string) {
  return /\.[cm]?[jt]sx?$/.test(file) && !file.endsWith('/graphql-api-types.ts');
}
