import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

const cli = resolve('scripts/docs/cli.mjs');
function put(root, file, content) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}
function run(root, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}
function ok(root, ...args) {
  const result = run(root, ...args);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  return JSON.parse(result.stdout);
}
function bad(root, args, pattern) {
  const result = run(root, ...args);
  assert.notEqual(result.status, 0, result.stdout);
  if (pattern) assert.match(result.stderr + result.stdout, pattern);
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'feature docs fixture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  put(root, 'package.json', JSON.stringify({ private: true }));
  cpSync(resolve('docs/templates'), join(root, 'docs/templates'), { recursive: true });
  cpSync(resolve('scripts/docs'), join(root, 'scripts/docs'), { recursive: true });
  put(
    root,
    'docs/units.map.json',
    JSON.stringify([
      { id: 'one', kind: 'feature', title: 'One', globs: ['src/**'] },
      { id: 'two', kind: 'service', title: 'Two', globs: ['src/**'], status: 'wip' },
    ])
  );
  put(root, 'src/main.ts', 'export const count = 1;\n');
  return root;
}
function author(root) {
  const evidence = JSON.stringify({ path: 'src/main.ts', contains: 'export const count = 1;' });
  const technical =
    '# One\n\n## Scope\n\nCounter.\n\n## User workflow\n\nRead the count.\n\n' +
    `## Verified claims\n\n- [C1] Exports one. <!-- evidence: ${evidence} -->\n\n` +
    '## Verification\n\nRead source.\n\n## Limitations\n\nNo persistence.\n';
  put(root, 'docs/units/one/technical.md', technical);
  const hash = createHash('sha256').update(technical).digest('hex');
  put(
    root,
    'docs/units/one/business.md',
    `# One\n\n<!-- technical-sha256: ${hash} -->\n\n` +
      '## Purpose\n\nRead count.\n\n## Supported outcomes\n\n' +
      '- Count is one. [C1]\n\n## Limitations\n\nNo persistence.\n'
  );
}
function stamp(root) {
  const context = ok(root, 'context', '--unit', 'one');
  ok(root, 'status', '--unit', 'one', '--stamp', '--fingerprint', context.fingerprint);
}
test('backfill is idempotent, preserves edits, and never marks templates current', (t) => {
  const root = fixture(t);
  bad(root, ['status', '--check']);
  ok(root, 'backfill-one', '--unit', 'one');
  assert.equal(existsSync(join(root, 'docs/units.lock.json')), false);
  bad(root, ['validate', '--unit', 'one'], /placeholder/);
  author(root);
  const before = readFileSync(join(root, 'docs/units/one/technical.md'), 'utf8');
  assert.deepEqual(ok(root, 'backfill-one', '--unit', 'one')[0].created, []);
  assert.equal(readFileSync(join(root, 'docs/units/one/technical.md'), 'utf8'), before);
  ok(root, 'validate', '--unit', 'one');
  stamp(root);
  assert.equal(ok(root, 'status', '--check')[0].status, 'current');
  const snapshot = readFileSync(join(root, 'docs/units.lock.json'), 'utf8');
  stamp(root);
  assert.equal(readFileSync(join(root, 'docs/units.lock.json'), 'utf8'), snapshot);
});
test('source addition/removal, templates and documentation edits invalidate freshness', (t) => {
  const root = fixture(t);
  author(root);
  stamp(root);
  put(root, 'src/extra.ts', 'export const extra = true;');
  bad(root, ['status', '--check']);
  rmSync(join(root, 'src/extra.ts'));
  ok(root, 'status', '--check');
  const template = readFileSync(join(root, 'docs/templates/feature.business.md'), 'utf8');
  put(root, 'docs/templates/feature.business.md', template + '\n');
  bad(root, ['status', '--check']);
  put(root, 'docs/templates/feature.business.md', template);
  const path = 'docs/units/one/business.md';
  put(root, path, readFileSync(join(root, path), 'utf8') + '\nEdited.\n');
  bad(root, ['status', '--check']);
});
test('evidence mismatch, unknown business claim, and stale technical digest fail validation', (t) => {
  const root = fixture(t);
  author(root);
  put(root, 'src/main.ts', 'export const count = 2;');
  bad(root, ['validate', '--unit', 'one'], /no longer matches/);
  put(root, 'src/main.ts', 'export const count = 1;\n');
  const path = 'docs/units/one/business.md';
  const original = readFileSync(join(root, path), 'utf8');
  put(root, path, original.replace('[C1]', '[C99]'));
  bad(root, ['validate', '--unit', 'one'], /existing technical claim/);
  put(root, path, original.replace(/technical-sha256: [a-f0-9]+/, 'technical-sha256: ' + '0'.repeat(64)));
  bad(root, ['validate', '--unit', 'one'], /digest/);
});
test('stamp refuses outdated dossiers and wip; malformed locks fail', (t) => {
  const root = fixture(t);
  author(root);
  const context = ok(root, 'context', '--unit', 'one');
  put(root, 'src/extra.ts', '// newer source');
  bad(root, ['status', '--unit', 'one', '--stamp', '--fingerprint', context.fingerprint], /Sources changed/);
  bad(root, ['status', '--unit', 'two', '--stamp', '--fingerprint', context.fingerprint], /wip/);
  put(root, 'docs/units.lock.json', '{}');
  bad(root, ['status', '--check'], /Invalid docs/);
});
test('overlapping units list identical members and wip suppresses drift only', (t) => {
  const root = fixture(t);
  const one = ok(root, 'context', '--unit', 'one');
  const two = ok(root, 'context', '--unit', 'two');
  assert.deepEqual(one.files, two.files);
  assert.equal(ok(root, 'status', '--unit', 'two', '--check')[0].status, 'wip');
  bad(root, ['validate', '--unit', 'two']);
  author(root);
  stamp(root);
  assert.equal(ok(root, 'drift', '--strict').ok, true);
  put(root, 'src/main.ts', 'changed');
  bad(root, ['drift', '--strict']);
  assert.equal(ok(root, 'drift').ok, false);
});
test('local exports are repeatable, require current docs, and never publish', (t) => {
  const root = fixture(t);
  author(root);
  bad(root, ['sync', '--unit', 'one', '--export'], /current/);
  stamp(root);
  const bundle = ok(root, 'sync', '--unit', 'one', '--export');
  assert.equal(bundle.published, false);
  assert.deepEqual(ok(root, 'sync', '--unit', 'one', '--export'), bundle);
  assert.equal(existsSync(join(root, bundle.destination, 'docs/units/one/technical.md')), true);
  bad(root, ['sync', '--unit', 'one', '--publish'], /not configured/);
  const guides = ok(root, 'sync-guides', '--export');
  assert.equal(guides.files, 8);
  put(root, `${bundle.destination}/manifest.json`, '{}');
  bad(root, ['sync', '--unit', 'one', '--export'], /Export was modified/);
  put(root, `${guides.destination}/docs/templates/feature.technical.md`, 'customized');
  bad(root, ['sync-guides', '--export'], /Export was modified/);
});
test('bad flags, registry duplicates, traversal and symlink writes fail safely', (t) => {
  const root = fixture(t);
  for (const args of [
    ['context'],
    ['backfill-one'],
    ['status', '--unit'],
    ['status', '--oops'],
    ['status', '--check', '--stamp'],
    ['status', '--unit', 'absent'],
    ['sync'],
  ])
    bad(root, args);
  const registry = readFileSync(join(root, 'docs/units.map.json'), 'utf8');
  put(root, 'docs/units.map.json', registry.replace('"two"', '"one"'));
  bad(root, ['status'], /duplicate/);
  put(root, 'docs/units.map.json', registry.replace('"one"', '"../one"'));
  bad(root, ['backfill'], /Invalid/);
  put(root, 'docs/units.map.json', registry);
  mkdirSync(join(root, 'outside'));
  mkdirSync(join(root, 'docs/units'));
  symlinkSync(join(root, 'outside'), join(root, 'docs/units/one'));
  bad(root, ['backfill-one', '--unit', 'one'], /Symlink/);
  assert.equal(existsSync(join(root, 'outside/technical.md')), false);
});
test('orphaned snapshots, index omissions and writer locks are visible failures', (t) => {
  const root = fixture(t);
  author(root);
  stamp(root);
  const lock = JSON.parse(readFileSync(join(root, 'docs/units.lock.json'), 'utf8'));
  lock.units.removed = lock.units.one;
  put(root, 'docs/units.lock.json', JSON.stringify(lock));
  bad(root, ['drift', '--strict'], /removed/);
  delete lock.units.removed;
  put(root, 'docs/units.lock.json', JSON.stringify(lock));
  put(root, '.claude/agents/unindexed.md', '# Agent');
  bad(root, ['drift', '--strict'], /missing from/);
  mkdirSync(join(root, '.claude/cache/feature-docs.lock'), { recursive: true });
  bad(root, ['backfill'], /busy/);
});

test('real feature-doc hook calls status for missing, current, stale and wip docs', (t) => {
  const root = fixture(t);
  put(
    root,
    'package.json',
    JSON.stringify({ scripts: { 'docs:status': `node '${cli.replaceAll("'", "'\\''")}' status` } })
  );
  const hook = resolve('.claude/hooks/feature-docs-drift.sh');
  function invoke() {
    rmSync(join(root, '.claude/cache'), { recursive: true, force: true });
    const result = spawnSync('bash', [hook], {
      cwd: root,
      encoding: 'utf8',
      input: JSON.stringify({ cwd: root, tool_name: 'Edit', tool_input: { file_path: join(root, 'src/main.ts') } }),
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout + result.stderr;
  }
  assert.match(invoke(), /one is missing/);
  author(root);
  stamp(root);
  assert.equal(invoke(), '');
  put(root, 'src/changed.ts', '// change');
  const warning = invoke();
  assert.match(warning, /one is stale/);
  assert.doesNotMatch(warning, /two is/);
});
