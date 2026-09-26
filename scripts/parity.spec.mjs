import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const runner = resolve('.claude/hooks/lib/docs-drift.mjs');
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'codex-parity-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'package.json'), '{}\n');
  const guidance = readFileSync('AGENTS.md', 'utf8');
  const files = ['AGENTS.md', 'CLAUDE.md', '.agents/skills/README.md'];
  for (const match of guidance.matchAll(/\]\(([^)]+\/(?:AGENTS|CLAUDE)\.md)\)/g)) files.push(match[1]);
  for (const file of files) {
    const target = join(directory, file);
    mkdirSync(resolve(target, '..'), { recursive: true });
    cpSync(join(root, file), target);
  }
  for (const name of ['use-scaffolders', 'lint', 'codegen', 'commit-changes']) {
    for (const folder of ['.agents', '.claude']) {
      cpSync(join(root, folder, 'skills', name), join(directory, folder, 'skills', name), { recursive: true });
    }
  }
  cpSync('.claude/skills/README.md', join(directory, '.claude/skills/README.md'));
  return directory;
}
function check(directory, strict = true) {
  return spawnSync(process.execPath, [runner, '--sweep', ...(strict ? ['--strict'] : [])], {
    cwd: directory,
    encoding: 'utf8',
  });
}
test('shared guidance and Codex skill ports pass the real strict drift CLI', (t) => {
  const result = check(fixture(t));
  assert.equal(result.status, 0, result.stderr);
});
test('missing scoped peer and unindexed extra scope fail; advisory mode remains nonblocking', (t) => {
  const directory = fixture(t);
  rmSync(join(directory, 'src/AGENTS.md'));
  mkdirSync(join(directory, 'extra'));
  writeFileSync(join(directory, 'extra/CLAUDE.md'), '# Additional scope\n');
  const result = check(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no scoped counterpart/);
  assert.match(result.stderr, /missing from root AGENTS/);
  assert.equal(check(directory, false).status, 0);
});
test('dangling root index and broken shared skill references fail', (t) => {
  const directory = fixture(t);
  rmSync(join(directory, 'src/graphql'), { recursive: true });
  writeFileSync(join(directory, '.agents/skills/codegen/SKILL.md'), 'Unmaintained workflow\n');
  const result = check(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /index points to missing/);
  assert.match(result.stderr, /must reference/);
});
test('removing the root import or a required skill fails', (t) => {
  const directory = fixture(t);
  writeFileSync(join(directory, 'CLAUDE.md'), '# Divergent rules\n');
  rmSync(join(directory, '.agents/skills/lint'), { recursive: true });
  const result = check(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must import/);
  assert.match(result.stderr, /missing Codex skill/);
});
