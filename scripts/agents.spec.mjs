import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

const hook = resolve('.claude/hooks/agent-scope.sh');

function put(root, path, text = '') {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return file;
}

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent scopes ' $ ")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  put(root, 'package.json', '{}');
  put(root, '.claude/settings.json', '{}');
  return root;
}

function run(root, role, tool, data = {}, cwd = root) {
  return spawnSync('bash', [hook, role], {
    cwd,
    input: JSON.stringify({ cwd, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: data }),
    encoding: 'utf8',
    // Worktree payload must win over the original checkout's environment.
    env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd(), CLAUDE_DISABLE_SCAFFOLD_GUARD: '1' },
  });
}

function allowed(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
}

function blocked(result) {
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /agent-scope: blocked:/);
}

test('architect can write plans, but cannot write source or invoke another mutation tool', (t) => {
  const root = fixture(t);
  allowed(run(root, 'architect', 'Write', { file_path: '.claude/plans/new/plan.md' }));
  const file = put(root, '.claude/plans/existing.md', 'original');
  allowed(run(root, 'architect', 'Write', { file_path: file }));
  for (const path of ['src/app.ts', '.claude/agents/architect.md', '.claude/plans-escape/plan.md', '.claude/plans']) {
    blocked(run(root, 'architect', 'Write', { file_path: path }));
  }
  for (const tool of ['Bash', 'Agent', 'Skill', 'Edit', 'MultiEdit', 'NotebookEdit', 'mcp__write']) {
    blocked(run(root, 'architect', tool, { file_path: file, command: 'touch src/app.ts' }));
  }
  assert.equal(readFileSync(file, 'utf8'), 'original');
});

test('tester allows autotests writes from nested packages and rejects outside targets', (t) => {
  const root = fixture(t);
  put(root, 'autotests/playwright/package.json', '{}');
  const cwd = join(root, 'autotests/playwright');
  for (const tool of ['Write', 'Edit']) {
    allowed(run(root, 'tester', tool, { file_path: 'tests/new.spec.ts' }, cwd));
    allowed(run(root, 'tester', tool, { file_path: join(root, 'autotests/playwright/tests/new.spec.ts') }));
    blocked(run(root, 'tester', tool, { file_path: 'src/app.ts' }));
    blocked(run(root, 'tester', tool, { file_path: 'autotests-other/test.ts' }));
    blocked(run(root, 'tester', tool, { file_path: 'autotests/../src/app.ts' }));
    blocked(run(root, 'tester', tool, { file_path: '/tmp/outside-agent-test.ts' }));
  }
  for (const tool of ['Bash', 'Agent', 'Skill', 'NotebookEdit', 'mcp__write']) blocked(run(root, 'tester', tool));
  for (const tool of ['Read', 'Grep', 'Glob']) allowed(run(root, 'tester', tool, { file_path: 'src/app.ts' }));
});

test('all scoped roles reject symlink and hard-link escapes, including missing targets', (t) => {
  const root = fixture(t);
  const outside = fixture(t);
  const source = put(outside, 'source.md', 'preserve');
  for (const [role, folder] of [
    ['architect', '.claude/plans'],
    ['tester', 'autotests'],
    ['bizdoc-writer', 'docs/units'],
    ['bizdoc-business-writer', 'docs/units'],
  ]) {
    mkdirSync(join(root, folder), { recursive: true });
    const escape = join(root, folder, `${role}-escape`);
    symlinkSync(outside, escape);
    blocked(run(root, role, 'Write', { file_path: join(escape, 'new.md') }));
    blocked(run(root, role, 'Write', { file_path: join(escape, 'source.md') }));
    const dangling = join(root, folder, `${role}-dangling.md`);
    symlinkSync(join(outside, 'missing.md'), dangling);
    blocked(run(root, role, 'Write', { file_path: dangling }));
    const hard = join(root, folder, `${role}-hard.md`);
    linkSync(source, hard);
    blocked(run(root, role, 'Edit', { file_path: hard }));
    blocked(run(root, role, 'Write', { file_path: hard }));
  }
  assert.equal(readFileSync(source, 'utf8'), 'preserve');
});

test('a symlinked scope directory itself is rejected', (t) => {
  const root = fixture(t);
  const outside = fixture(t);
  symlinkSync(outside, join(root, 'autotests'));
  blocked(run(root, 'tester', 'Write', { file_path: 'autotests/new.spec.ts' }));
});

test('MultiEdit checks all destinations and rejects malformed or ambiguous paths', (t) => {
  const root = fixture(t);
  allowed(run(root, 'tester', 'MultiEdit', { file_path: 'autotests/one.ts', edits: [{ old_string: 'x' }] }));
  blocked(
    run(root, 'tester', 'MultiEdit', {
      file_path: 'autotests/one.ts',
      edits: [{ file_path: 'autotests/two.ts' }, { file_path: 'src/app.ts' }],
    })
  );
  for (const data of [
    {},
    { file_path: '' },
    { file_path: 42 },
    { file_path: 'autotests/a.ts', path: 'src/app.ts' },
    { file_path: 'autotests/a.ts', edits: [] },
    { file_path: 'autotests/a.ts', edits: [null] },
    { file_path: 'autotests/a.ts', edits: [{ path: 'src/app.ts' }] },
  ])
    blocked(run(root, 'tester', 'MultiEdit', data));
});

test('doc writers can only use file tools on unit Markdown; business writer cannot launch shell/delegation', (t) => {
  const root = fixture(t);
  for (const role of ['bizdoc-writer', 'bizdoc-business-writer']) {
    allowed(run(root, role, 'Write', { file_path: 'docs/units/example/technical.md' }));
    for (const path of ['docs/units.map.json', 'docs/units.lock.json', 'docs/units/example/code.ts', 'src/app.ts']) {
      blocked(run(root, role, 'Write', { file_path: path }));
    }
  }
  allowed(run(root, 'bizdoc-writer', 'Bash', { command: 'npm run graph -- --symbol useExample' }));
  blocked(run(root, 'bizdoc-business-writer', 'Bash', { command: 'npm run graph -- --symbol useExample' }));
  blocked(run(root, 'bizdoc-business-writer', 'Agent'));
});

test('invalid payloads and unknown roles fail closed with blocking exit status', (t) => {
  const root = fixture(t);
  blocked(run(root, 'unknown', 'Write', { file_path: 'autotests/a.ts' }));
  for (const text of ['{', 'null', '[]', '{}']) {
    blocked(spawnSync('bash', [hook, 'tester'], { cwd: root, input: text, encoding: 'utf8' }));
  }
});
