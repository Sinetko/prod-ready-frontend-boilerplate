import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { format, resolveConfig } from 'prettier';

export const root = process.cwd();
export type Files = Map<string, string>;

export function sourcePath(input: string) {
  const target = resolve(root, input);
  const base = resolve(root, 'src');
  const rel = relative(base, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    throw new Error('Output path must be inside src/.');
  }
  let ancestor = target;
  while (!existsSync(ancestor)) {
    if (lstatSync(ancestor, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error('Output path contains a dangling symlink.');
    }
    ancestor = dirname(ancestor);
  }
  const actual = relative(base, realpathSync(ancestor));
  if (actual === '..' || actual.startsWith(`..${sep}`) || isAbsolute(actual)) {
    throw new Error('Output path escapes src/ through a symlink.');
  }
  return target;
}

export async function writeFiles(files: Files, editable: string[] = []) {
  const prepared = new Map<string, string>();
  const config = await resolveConfig(root + '/package.json');
  for (const [file, content] of files) {
    sourcePath(file);
    const formatted = await format(content, { ...config, filepath: file });
    if (existsSync(file) && readFileSync(file, 'utf8') !== formatted && !editable.includes(file)) {
      throw new Error(`Refusing to overwrite existing file: ${file}`);
    }
    prepared.set(file, formatted);
  }
  for (const [file, content] of prepared) {
    if (existsSync(file) && readFileSync(file, 'utf8') === content) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}
