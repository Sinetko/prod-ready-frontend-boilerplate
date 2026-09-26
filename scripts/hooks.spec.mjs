import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const hooks = resolve('.claude/hooks');
function put(directory, path, content) {
  const target = join(directory, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  return target;
}
function fixture(t, scripts = {}) {
  const directory = mkdtempSync(join(tmpdir(), "claude hooks ' $ fixture-"));
  put(directory, 'package.json', JSON.stringify({ scripts }));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function event(directory, tool = 'Write', values = {}) {
  return {
    cwd: directory,
    session_id: 'test-session',
    hook_event_name: 'PostToolUse',
    tool_name: tool,
    tool_input: { file_path: join(directory, 'src/changed.ts'), ...values },
  };
}
function run(name, data, args = [], env = {}) {
  const result = spawnSync('bash', [join(hooks, `${name}.sh`), ...args], {
    cwd: data.cwd,
    input: JSON.stringify(data),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
  });
  assert.equal(result.error, undefined);
  return result;
}
function parallel(name, data) {
  return new Promise((accept, reject) => {
    const child = spawn('bash', [join(hooks, `${name}.sh`)], {
      cwd: data.cwd,
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (status) => accept({ status, stdout, stderr }));
    child.stdin.end(JSON.stringify(data));
  });
}
function message(result) {
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout).systemMessage : '';
}

test('settings register real handlers, async telemetry/refreshes, and narrowly scoped permissions', () => {
  const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
  const events = [
    'PreToolUse',
    'PostToolUse',
    'Stop',
    'SessionStart',
    'SessionEnd',
    'PreCompact',
    'PostCompact',
    'UserPromptSubmit',
    'SubagentStart',
    'SubagentStop',
  ];
  assert.deepEqual(Object.keys(settings.hooks).sort(), events.sort());
  for (const groups of Object.values(settings.hooks)) {
    for (const group of groups) {
      if (group.matcher) assert.doesNotThrow(() => new RegExp(group.matcher));
      for (const handler of group.hooks) {
        assert.equal(handler.type, 'command');
        assert.equal(handler.command, 'bash');
        assert.equal(handler.args.length, 1);
        const path = handler.args[0].replace('${CLAUDE_PROJECT_DIR}', root);
        assert.ok(existsSync(path), path);
        assert.equal(spawnSync('bash', ['-n', path]).status, 0);
        if (/session-logger|regenerate-|docs-drift/.test(path)) assert.equal(handler.async, true);
        else assert.notEqual(handler.async, true);
      }
    }
  }
  const allow = settings.permissions.allow;
  assert.ok(allow.includes('Bash(npm run graph -- *)'));
  assert.ok(allow.includes('Bash(npm run graphql-extract -- *)'));
  assert.equal(new Set(allow).size, allow.length);
  for (const rule of allow) {
    assert.match(rule, /^Bash\((git (status|log|diff|show)( |\))|npm (run |test\)))/);
    if (rule.includes('*')) assert.match(rule, /^Bash\(npm run (graph|graphql-extract) -- \*\)$/);
    assert.doesNotMatch(rule, /--fix|generate-|npm run \*|Bash\(\*|git \*/);
  }
});

test('scaffold guard blocks every new artefact shape and allows existing files and unrelated files', (t) => {
  const directory = fixture(t);
  const shapes = [
    'src/features/example/pages/new/new.page.tsx',
    'src/graphql/queries/new/new.tag.ts',
    'src/graphql/mutations/new/new.tag.ts',
    'src/graphql/fragments/new.fragment.ts',
    'src/shared/hooks/new/new.hook.ts',
    'src/shared/utils/new/new.util.ts',
    'src/shared/utils/new/new.utils.ts',
    'src/shared/components/new/new.component.tsx',
    'src/core/stores/new/new.store.ts',
    'src/core/contexts/new/new.context.tsx',
  ];
  for (const path of shapes) {
    const data = event(directory, 'Write', { file_path: join(directory, path) });
    data.hook_event_name = 'PreToolUse';
    assert.equal(run('scaffold-guard', data).status, 2, path);
    assert.ok(!existsSync(join(directory, path)), 'inspection must not create files');
    put(directory, path, 'existing');
    for (const tool of ['Write', 'Edit', 'MultiEdit']) {
      assert.equal(run('scaffold-guard', { ...data, tool_name: tool }).status, 0, path);
    }
  }
  assert.equal(run('scaffold-guard', event(directory)).status, 0);
  const multiple = event(directory, 'MultiEdit', { edits: [{ file_path: 'src/fresh.hook.ts' }] });
  assert.equal(run('scaffold-guard', multiple).status, 2);
  assert.equal(run('scaffold-guard', multiple, [], { CLAUDE_DISABLE_SCAFFOLD_GUARD: '1' }).status, 0);
});

test('scaffold guard recognizes shell destinations, directories, quoting, heredocs, and shell wrappers', (t) => {
  const directory = fixture(t);
  put(directory, 'source.hook.ts', 'existing');
  put(directory, 'tree/inside/new.store.ts', 'existing');
  mkdirSync(join(directory, 'dest'));
  symlinkSync(join(directory, 'dest'), join(directory, 'alias'));
  const blocked = [
    'echo data > "dest/new hook.hook.ts"',
    'echo data >> dest/new.hook.ts',
    'echo data >| dest/new.hook.ts',
    'tee -a dest/new.hook.ts dest/second.hook.ts',
    'touch -- dest/new.hook.ts',
    'touch -t 202601010000 dest/new.hook.ts',
    'cp source.hook.ts dest/',
    'mv source.hook.ts dest/',
    'cp -t dest source.hook.ts',
    'cp --target-directory=dest source.hook.ts',
    'install -D -m 644 source.hook.ts dest/new.hook.ts',
    'cp -R tree dest/',
    'cp -R tree fresh/',
    'cd dest && touch new.hook.ts',
    'touch alias/new.hook.ts',
    "bash -c 'touch dest/new.hook.ts'",
    "sh -c 'touch dest/new.hook.ts'",
    'touch "$UNKNOWN/new.hook.ts"',
    'env FLAG=1 touch dest/new.hook.ts',
    'command -p touch dest/new.hook.ts',
    "cat > dest/new.hook.ts <<'EOF'\ncontent\nEOF\n",
  ];
  for (const command of blocked) {
    assert.equal(run('scaffold-guard', event(directory, 'Bash', { command })).status, 2, command);
  }
  const allowed = [
    'cat source.hook.ts',
    'rg "new.hook.ts" .',
    'touch source.hook.ts',
    'echo "dest/new.hook.ts"',
    'echo "a > dest/new.hook.ts"',
    'echo hello > notes.txt',
    'cd "$UNKNOWN" && rg new.hook.ts',
    'cp source.hook.ts source.hook.ts',
    'npm run generate-hook -- --non-interactive --name fresh',
    "cat <<'EOF'\ntouch dest/new.hook.ts\nEOF\n",
  ];
  for (const command of allowed) {
    const result = run('scaffold-guard', event(directory, 'Bash', { command }));
    assert.equal(result.status, 0, `${command}: ${result.stderr}`);
  }
});

function transcript(directory, cacheRead, output) {
  const lines = [
    { type: 'user', message: { content: 'previous' } },
    { type: 'assistant', message: { id: 'old', usage: { output_tokens: 90000 } } },
    { type: 'user', message: { content: [{ type: 'text', text: 'new prompt' }] } },
    { type: 'assistant', message: { id: 'tool-message', usage: { output_tokens: 200 } } },
    { type: 'user', message: { content: [{ type: 'tool_result', content: 'result' }] } },
    { type: 'assistant', message: { id: 'final', usage: { output_tokens: output - 200 } } },
    {
      type: 'assistant',
      message: {
        id: 'final',
        usage: { output_tokens: output - 200, cache_read_input_tokens: cacheRead },
      },
    },
  ];
  return put(directory, 'transcript.jsonl', lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
}

test('budget warnings use exact thresholds, deduplicate messages, retain tool turns, and never block', (t) => {
  const directory = fixture(t);
  for (const [cacheRead, output, expected] of [
    [250000, 1200, ''],
    [250001, 1201, 'WARNING'],
    [400000, 3000, 'WARNING'],
    [400001, 3001, 'CRITICAL'],
  ]) {
    const data = { cwd: directory, hook_event_name: 'Stop', transcript_path: transcript(directory, cacheRead, output) };
    for (const name of ['context-budget', 'output-budget']) {
      const text = message(run(name, data));
      if (expected) assert.ok(text.includes(expected), text);
      else assert.equal(text, '');
      assert.doesNotMatch(text, /decision|stopReason/);
    }
    assert.equal(run('output-budget', data, [], { CLAUDE_DISABLE_OUTPUT_BUDGET: '1' }).stdout, '');
  }
  assert.match(message(run('context-budget', { cwd: directory })), /unavailable/);
  const data = { cwd: directory, transcript_path: put(directory, 'broken.jsonl', 'not json\n') };
  assert.match(message(run('output-budget', data)), /unavailable/);
  assert.match(message(run('context-budget', { cwd: directory, transcript_path: 'missing' })), /warning/i);
});

test('logger stores only metadata, handles every lifecycle, and reads subagent usage separately', (t) => {
  const directory = fixture(t);
  const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
  for (const name of Object.keys(settings.hooks)) {
    const data = {
      ...event(directory),
      hook_event_name: name,
      prompt: 'secret text',
      last_assistant_message: 'secret text',
      transcript_path: transcript(directory, 300000, 1400),
    };
    if (name === 'SubagentStop')
      data.agent_transcript_path = put(
        directory,
        'agent.jsonl',
        JSON.stringify({
          type: 'assistant',
          message: { id: 'agent', usage: { output_tokens: 77, cache_read_input_tokens: 99 } },
        }) + '\n'
      );
    assert.equal(run('session-logger', data).status, 0);
  }
  const cache = join(directory, '.claude/cache/hooks');
  const file = readdirSync(cache).find((name) => name.startsWith('session-'));
  const text = readFileSync(join(cache, file), 'utf8');
  assert.doesNotMatch(text, /secret text|changed.ts|transcript_path/);
  const records = text
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(records.length, Object.keys(settings.hooks).length);
  assert.equal(records.find((record) => record.event === 'Stop').usage.output_tokens, 1400);
  assert.equal(records.find((record) => record.event === 'SubagentStop').usage.output_tokens, 77);
});

test('docs sweep catches missing indexes for all artefact categories and strict mode fails', (t) => {
  const directory = fixture(t);
  const files = ['.claude/hooks/x.sh', '.claude/agents/x.md', '.claude/skills/x/SKILL.md', 'scripts/generate-x.ts'];
  for (const path of files) put(directory, path, 'fixture');
  const data = event(directory);
  const missing = run('docs-drift', data, ['--sweep', '--strict']);
  assert.equal(missing.status, 1);
  for (const path of files) assert.ok(missing.stderr.includes(path));
  assert.equal(run('docs-drift', data, ['--sweep']).status, 0);
  assert.match(message(run('docs-drift', data)), /missing/);
  put(directory, 'README.md', files.map((file) => `- \`${file}\``).join('\n'));
  assert.equal(run('docs-drift', data, ['--sweep', '--strict']).status, 0);
  put(directory, 'README.md', 'generate-xyz .claude/agents/x.md.backup');
  assert.equal(run('docs-drift', data, ['--strict']).status, 1);
  assert.equal(run('docs-drift', data, ['--unknown']).status, 1);
});

test('feature drift checks overlapping units, wip, missing/stale/current docs, throttling and pending setup', (t) => {
  const directory = fixture(t, { 'docs:status': 'node status.cjs' });
  put(directory, 'status.cjs', "require('fs').appendFileSync('calls', process.argv.join(' ')+'\\n'); process.exit(1);");
  const data = event(directory, 'Edit', { file_path: join(directory, 'src/features/example/view.ts') });
  assert.match(message(run('feature-docs-drift', data)), /Phase 14 setup pending/);
  put(
    directory,
    'docs/units.map.json',
    JSON.stringify([
      { id: 'missing', globs: ['src/features/**'] },
      { id: 'stale', globs: ['src/**/*.ts'] },
      { id: 'wip', status: 'wip', globs: ['src/**'] },
      { id: 'other', globs: ['unrelated/**'] },
    ])
  );
  put(directory, 'docs/units/stale/technical.md', 'documentation');
  const result = message(run('feature-docs-drift', data));
  assert.match(result, /missing.*technical.md/);
  assert.match(result, /stale.*stale/);
  assert.doesNotMatch(result, /wip|other/);
  assert.equal(message(run('feature-docs-drift', data)), '');
  assert.equal(readFileSync(join(directory, 'calls'), 'utf8').trim().split('\n').length, 1);
  const cache = join(directory, '.claude/cache/hooks');
  for (const name of readdirSync(cache).filter((file) => file.endsWith('.stamp'))) put(cache, name, '0');
  put(directory, 'docs/units/missing/technical.md', 'documentation');
  put(directory, 'status.cjs', 'process.exit(0);');
  assert.equal(message(run('feature-docs-drift', data)), '');
  put(directory, 'docs/units.map.json', JSON.stringify([{ id: '../escape', globs: ['src/**'] }]));
  assert.match(message(run('feature-docs-drift', data)), /Invalid/);
});

test('auto-codegen triggers only source documents, handles removal, and surfaces command failure', (t) => {
  const directory = fixture(t, { 'generate-code': 'node codegen.cjs' });
  put(directory, 'codegen.cjs', "require('fs').appendFileSync('calls', 'codegen\\n');");
  const triggering = [
    'src/graphql/fragments/a.fragment.ts',
    'src/graphql/queries/a/a.tag.ts',
    'src/graphql/mutations/a/a.graphql',
    'src/graphql/queries/misc.tsx',
  ];
  for (const path of triggering) {
    put(directory, path, 'const doc = gql`query X { hello }`;');
    assert.equal(run('auto-codegen', event(directory, 'Edit', { file_path: join(directory, path) })).status, 0);
  }
  const removed = put(directory, 'src/graphql/queries/removed.ts', 'export {};');
  assert.equal(
    run(
      'auto-codegen',
      event(directory, 'Edit', {
        file_path: removed,
        old_string: 'gql`query X { hello }`',
      })
    ).status,
    0
  );
  for (const path of [
    'src/graphql/graphql-api-types.ts',
    'src/graphql/documents.graphql',
    'src/graphql/schema.graphql',
  ]) {
    assert.equal(run('auto-codegen', event(directory, 'Edit', { file_path: join(directory, path) })).status, 0);
  }
  assert.equal(readFileSync(join(directory, 'calls'), 'utf8').trim().split('\n').length, 5);
  put(directory, 'codegen.cjs', 'process.exit(1);');
  const failure = run('auto-codegen', event(directory, 'Edit', { file_path: removed, old_string: 'gql`old`' }));
  assert.equal(failure.status, 2);
  assert.match(failure.stderr, /auto-codegen/);
});

test('graph baseline is cheap when fresh; parallel edit refresh waits for codegen and coalesces writes', async (t) => {
  const directory = fixture(t, {
    'generate-code': 'node codegen.cjs',
    graph: 'node query.cjs',
    'graph-generate': 'node generate.cjs',
  });
  put(
    directory,
    'codegen.cjs',
    `
    setTimeout(() => {
      require('fs').appendFileSync('order', 'codegen\\n');
      require('fs').rmSync('fresh', { force: true });
    }, 200);
  `
  );
  put(directory, 'query.cjs', "process.exit(require('fs').existsSync('fresh') ? 0 : 1);");
  put(
    directory,
    'generate.cjs',
    `
    require('fs').appendFileSync('order', 'graph\\n');
    require('fs').writeFileSync('fresh', 'yes');
  `
  );
  const data = event(directory, 'Edit', { file_path: join(directory, 'src/graphql/queries/a/a.tag.ts') });
  data.tool_use_id = 'unique-edit';
  const [graph, codegen] = await Promise.all([
    parallel('regenerate-context-graphs', data),
    parallel('auto-codegen', data),
  ]);
  assert.equal(message(graph), '');
  assert.equal(codegen.status, 0, codegen.stderr);
  assert.equal(readFileSync(join(directory, 'order'), 'utf8'), 'codegen\ngraph\n');
  const baseline = { cwd: directory, hook_event_name: 'SessionStart' };
  for (const result of await Promise.all([
    parallel('regenerate-graphs-core', baseline),
    parallel('regenerate-graphs-core', baseline),
  ]))
    assert.equal(message(result), '');
  assert.equal(readFileSync(join(directory, 'order'), 'utf8'), 'codegen\ngraph\n');
  rmSync(join(directory, 'fresh'));
  const refresh = await Promise.all([
    parallel('regenerate-graphs-core', baseline),
    parallel('regenerate-graphs-core', baseline),
  ]);
  refresh.forEach((result) => assert.equal(message(result), ''));
  assert.equal(readFileSync(join(directory, 'order'), 'utf8'), 'codegen\ngraph\ngraph\n');
  put(directory, 'generate.cjs', 'process.exit(1);');
  rmSync(join(directory, 'fresh'));
  assert.match(message(run('regenerate-graphs-core', { ...baseline, hook_event_name: 'PostCompact' })), /failed/);
});

test('graph refresh recovers a dead lock, skips generated cache edits, and reports a failed codegen receipt', (t) => {
  const directory = fixture(t, {
    'generate-code': 'node fail.cjs',
    graph: 'node query.cjs',
    'graph-generate': 'node generate.cjs',
  });
  put(directory, 'fail.cjs', 'process.exit(1);');
  put(directory, 'query.cjs', 'process.exit(1);');
  put(directory, 'generate.cjs', "require('fs').writeFileSync('generated', 'yes');");
  // Obtain a definitely exited child PID instead of assuming a magic PID is free.
  const exited = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  put(directory, '.claude/cache/hooks/graphs.lock', String(exited.pid));
  assert.equal(message(run('regenerate-graphs-core', { cwd: directory, hook_event_name: 'SessionStart' })), '');
  assert.ok(existsSync(join(directory, 'generated')));
  rmSync(join(directory, 'generated'));
  const ignored = event(directory, 'Write', { file_path: join(directory, '.claude/context-graphs/index.json') });
  assert.equal(message(run('regenerate-context-graphs', ignored)), '');
  assert.ok(!existsSync(join(directory, 'generated')));
  const edit = event(directory, 'Edit', { file_path: join(directory, 'src/graphql/fragments/x.fragment.ts') });
  edit.tool_use_id = 'failed-edit';
  assert.equal(run('auto-codegen', edit).status, 2);
  assert.match(message(run('regenerate-context-graphs', edit)), /deferred/);
  assert.ok(!existsSync(join(directory, 'generated')));
});

test('feature drift checks missing status integration and throttles concurrent calls per unit', async (t) => {
  const directory = fixture(t);
  put(directory, 'docs/units.map.json', JSON.stringify([{ id: 'unit', globs: ['src/**'] }]));
  put(directory, 'docs/units/unit/technical.md', 'doc');
  const data = event(directory);
  assert.match(message(run('feature-docs-drift', data)), /freshness unknown/);
  put(directory, 'status.cjs', "require('fs').appendFileSync('calls', 'status\\n'); process.exit(1);");
  put(directory, 'package.json', JSON.stringify({ scripts: { 'docs:status': 'node status.cjs' } }));
  const key = createHash('sha256').update('unit').digest('hex');
  put(directory, `.claude/cache/hooks/feature-${key}.stamp`, String(Date.now() - 30001));
  const results = await Promise.all([parallel('feature-docs-drift', data), parallel('feature-docs-drift', data)]);
  results.forEach((result) => assert.equal(result.status, 0));
  assert.equal(results.filter((result) => message(result).includes('stale')).length, 1);
  assert.equal(readFileSync(join(directory, 'calls'), 'utf8'), 'status\n');
});

test('hook root selection follows the worktree cwd and ignores nested package roots', (t) => {
  const directory = fixture(t);
  put(directory, '.git', 'gitdir: fixture');
  put(directory, 'nested/package.json', '{}');
  const data = event(join(directory, 'nested'));
  data.hook_event_name = 'SessionStart';
  assert.equal(run('session-logger', data).status, 0);
  assert.ok(existsSync(join(directory, '.claude/cache/hooks')));
  assert.ok(!existsSync(join(directory, 'nested/.claude')));
});

test('invalid JSON blocks guard inspection but advisory hooks never block a turn', (t) => {
  const directory = fixture(t);
  for (const name of ['scaffold-guard', 'context-budget', 'output-budget', 'feature-docs-drift', 'session-logger']) {
    const result = spawnSync('bash', [join(hooks, `${name}.sh`)], {
      cwd: directory,
      input: '{not-json',
      encoding: 'utf8',
    });
    assert.equal(result.status, name === 'scaffold-guard' ? 2 : 0, result.stderr);
  }
});
