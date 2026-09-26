import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
if (!['generate', 'query'].includes(mode)) throw new Error('Expected generate or query');
const files = [
  'graph-generate.ts',
  'graph-query.ts',
  ...readdirSync(join(root, 'scripts/graphs'))
    .filter((file) => file.endsWith('.ts'))
    .map((file) => `graphs/${file}`),
];
const contents = files.map((file) => readFileSync(join(root, 'scripts', file), 'utf8'));
const hash = createHash('sha256')
  .update(ts.version)
  .update(readFileSync(fileURLToPath(import.meta.url)));
contents.forEach((content) => hash.update(content));
const output = join(root, '.claude/cache/graph-tools', hash.digest('hex'));
for (const [index, file] of files.entries()) {
  const target = join(output, file.replace(/\.ts$/, '.mjs'));
  if (existsSync(target)) continue;
  mkdirSync(dirname(target), { recursive: true });
  const compiled = ts
    .transpileModule(contents[index], {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, esModuleInterop: true },
      fileName: file,
    })
    .outputText.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, '$1$2.mjs$3');
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, compiled);
  renameSync(temporary, target);
}
const child = spawnSync(process.execPath, [join(output, `graph-${mode}.mjs`), ...process.argv.slice(3)], {
  stdio: 'inherit',
});
if (child.error) throw child.error;
process.exitCode = child.status ?? 1;
