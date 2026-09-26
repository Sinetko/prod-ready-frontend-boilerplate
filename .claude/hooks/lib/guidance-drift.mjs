import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function guidanceDrift(root) {
  const read = (file) => readFileSync(join(root, file), 'utf8');
  if (!existsSync(join(root, 'AGENTS.md'))) {
    return existsSync(join(root, 'CLAUDE.md')) && read('CLAUDE.md').includes('@AGENTS.md')
      ? ['docs-drift: shared root AGENTS.md is missing.']
      : [];
  }
  const messages = [];
  const report = (message) => messages.push(`docs-drift: ${message}`);
  const main = read('AGENTS.md');
  if (!existsSync(join(root, 'CLAUDE.md')) || !read('CLAUDE.md').includes('@AGENTS.md')) {
    report('root CLAUDE.md must import the shared AGENTS.md.');
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
  function walk(folder = '') {
    for (const entry of readdirSync(join(root, folder), { withFileTypes: true })) {
      const file = folder ? `${folder}/${entry.name}` : entry.name;
      if (ignored.has(entry.name) || /^\.claude\/(cache|context-graphs)$/.test(file) || file === '.husky/_') continue;
      if (entry.isDirectory()) walk(file);
      else if (folder && ['AGENTS.md', 'CLAUDE.md'].includes(entry.name)) {
        if (!main.includes(`](${file})`)) report(`${file} is missing from root AGENTS.md's scoped index.`);
        const peer = `${folder}/${entry.name === 'AGENTS.md' ? 'CLAUDE.md' : 'AGENTS.md'}`;
        if (!existsSync(join(root, peer))) report(`${file} has no scoped counterpart ${peer}.`);
        if (entry.name === 'AGENTS.md' && !read(file).includes('[CLAUDE.md](CLAUDE.md)')) {
          report(`${file} must point to its maintained scoped CLAUDE.md.`);
        }
      }
    }
  }
  walk();
  for (const match of main.matchAll(/\]\(([^)]+\/(?:AGENTS|CLAUDE)\.md)\)/g)) {
    if (!existsSync(join(root, match[1]))) report(`scoped index points to missing ${match[1]}.`);
  }
  for (const name of ['use-scaffolders', 'lint', 'codegen', 'commit-changes']) {
    const file = `.agents/skills/${name}/SKILL.md`;
    const source = `.claude/skills/${name}/SKILL.md`;
    if (!existsSync(join(root, file))) report(`missing Codex skill ${file}.`);
    else if (!read(file).includes(`](../../../${source})`)) report(`${file} must reference ${source}.`);
    if (!existsSync(join(root, source))) report(`missing shared workflow ${source}.`);
  }
  return messages;
}
