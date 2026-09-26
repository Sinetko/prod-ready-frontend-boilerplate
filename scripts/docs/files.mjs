import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const root = process.cwd();
export function local(file) {
  if (typeof file !== 'string' || !file || isAbsolute(file) || /[\\\0]/.test(file)) {
    throw new Error(`Invalid repository path: ${file}`);
  }
  const parts = file.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe path: ${file}`);
  let target = root;
  for (const part of parts) {
    target = join(target, part);
    if (
      existsSync(target) ||
      (() => {
        try {
          return lstatSync(target).isSymbolicLink();
        } catch {
          return false;
        }
      })()
    ) {
      if (lstatSync(target).isSymbolicLink()) throw new Error(`Symlink is not allowed: ${file}`);
    }
  }
  return resolve(root, file);
}
export function read(file) {
  return readFileSync(local(file), 'utf8');
}
export function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
export function write(file, content, onlyMissing = false) {
  const target = local(file);
  if (existsSync(target)) {
    if (onlyMissing || readFileSync(target, 'utf8') === content) return false;
  }
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, content, { flag: 'wx' });
    renameSync(temp, target);
  } finally {
    rmSync(temp, { force: true });
  }
  return true;
}
export function json(file, value) {
  return write(file, `${JSON.stringify(value, null, 2)}\n`);
}
export function locked(action) {
  const lock = local('.claude/cache/feature-docs.lock');
  mkdirSync(dirname(lock), { recursive: true });
  try {
    mkdirSync(lock);
  } catch {
    throw new Error('Docs writer is busy; retry or inspect stale feature-docs.lock.');
  }
  try {
    return action();
  } finally {
    rmSync(lock, { recursive: true });
  }
}
const ignored = new Set([
  '.git',
  'node_modules',
  '.pnpm-store',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
]);
export function inventory(folder = '') {
  const directory = folder ? local(folder) : root;
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = folder ? `${folder}/${entry.name}` : entry.name;
      if (file === '.husky/_') return [];
      if (ignored.has(entry.name) || /^\.claude\/(cache|context-graphs)(\/|$)/.test(file)) return [];
      if (/\.(tsbuildinfo|log|tmp)$/.test(file) || file.endsWith('.eslintcache')) return [];
      if (entry.isSymbolicLink()) return [];
      return entry.isDirectory() ? inventory(file) : entry.isFile() ? [file] : [];
    })
    .sort();
}
export function generated(file) {
  return /^src\/graphql\/(graphql-api-types\.ts|schema\.graphql(?:\.json)?|documents\.graphql)$/.test(file);
}
