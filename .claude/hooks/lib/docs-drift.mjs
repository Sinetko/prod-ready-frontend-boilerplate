import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { guidanceDrift } from './guidance-drift.mjs';
import { input, notify, rootFor } from './runtime.mjs';

function entries(root, folder, suffix) {
  const path = join(root, folder);
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .filter((entry) => !['README.md', 'CLAUDE.md', 'AGENTS.md', 'index.md'].includes(entry.name))
    .map((entry) => `${folder}/${entry.name}`);
}

function indexed(root, file) {
  let directory = dirname(file);
  const names = [file, file.replace(/\.ts$/, '')];
  if (/scripts\/generate-[^/]+\.ts$/.test(file)) names.push(file.slice(8, -3));
  for (;;) {
    names.push(relative(directory, file).replaceAll('\\', '/'));
    for (const index of ['README.md', 'index.md']) {
      const path = join(root, directory, index);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, 'utf8');
      if (
        names.some((name) => {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`(^|[^\\w./-])${escaped}(?=$|[^\\w./-])`, 'm').test(text);
        })
      ) {
        return true;
      }
    }
    if (directory === '.') return false;
    directory = dirname(directory);
  }
}

const args = process.argv.slice(2);
const cli = args.length > 0;
try {
  if (args.some((arg) => !['--sweep', '--strict'].includes(arg))) throw new Error('Use --sweep [--strict]');
  const root = rootFor(cli ? { cwd: process.cwd() } : input());
  const files = [
    ...entries(root, '.claude/hooks', '.sh'),
    ...entries(root, '.claude/agents', '.md'),
    ...entries(root, 'scripts', '.ts').filter((file) => /\/generate-[^/]+\.ts$/.test(file)),
  ];
  for (const folder of ['.claude/skills', '.agents/skills']) {
    const skills = join(root, folder);
    if (existsSync(skills)) {
      for (const entry of readdirSync(skills, { withFileTypes: true })) {
        if (entry.isDirectory() && existsSync(join(skills, entry.name, 'SKILL.md'))) {
          files.push(`${folder}/${entry.name}/SKILL.md`);
        }
      }
    }
  }
  const missing = files.filter((file) => !indexed(root, file));
  const messages = missing.map((file) => `docs-drift: ${file} is missing from an ancestor README.md/index.md.`);
  messages.push(...guidanceDrift(root));
  if (cli) {
    messages.forEach((message) => console.error(message));
    if (!messages.length) console.log(`docs-drift: ${files.length} artefacts indexed.`);
    if (messages.length && args.includes('--strict')) process.exitCode = 1;
  } else notify(messages);
} catch (error) {
  if (cli) {
    console.error(`docs-drift: ${error.message}`);
    process.exitCode = 1;
  } else notify([`docs-drift: ${error.message}`]);
}
