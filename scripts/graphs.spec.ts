import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const builder = resolve('scripts/graph-build.mjs');
function put(rootPath: string, path: string, content: string) {
  const target = join(rootPath, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
function run(directory: string, mode: 'generate' | 'query', args: string[] = [], success = true) {
  const result = spawnSync(process.execPath, [builder, mode, ...args], { cwd: directory, encoding: 'utf8' });
  if (success) assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  else assert.notEqual(result.status, 0, result.stdout);
  return result;
}
function query(directory: string, args: string[]) {
  return JSON.parse(run(directory, 'query', [...args, '--json']).stdout) as {
    graph: string;
    records: { relation: string; from: string; to: string; path: string; name?: string }[];
  };
}
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'context-graphs-'));
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  put(
    directory,
    'package.json',
    JSON.stringify({
      scripts: { build: 'vite build', codegen: 'npm run generate-code' },
      // eslint-disable-next-line @typescript-eslint/naming-convention -- npm package name.
      dependencies: { react: '*', 'react-i18next': '*', graphql: '*' },
    })
  );
  put(
    directory,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        baseUrl: 'src',
        moduleResolution: 'node',
        jsx: 'preserve',
        module: 'ESNext',
        esModuleInterop: true,
      },
      include: ['src'],
    })
  );
  put(directory, 'src/shared/utils/example/example.util.ts', 'export function example() { return 1; }');
  put(directory, 'src/shared/utils/example/index.ts', "export { example } from './example.util';");
  put(
    directory,
    'src/shared/hooks/use-example/use-example.hook.ts',
    "import { example as value } from 'shared/utils/example'; export function useExample() { return value(); }"
  );
  put(directory, 'src/shared/components/widget.component.tsx', 'export function Widget() { return <div />; }');
  put(
    directory,
    'src/features/example/pages/example/example.page.tsx',
    `
import { useTranslation } from 'react-i18next';
import { useExample } from 'shared/hooks/use-example/use-example.hook';
import { Widget } from 'shared/components/widget.component';
export function ExamplePage() { const { t: text } = useTranslation('example');
 const count = useExample(); return <Widget title={text('title')} count={count} />; }`
  );
  put(
    directory,
    'src/features/example/pages/example/example.translations.ts',
    "export const exampleTranslations = { title: 'Hello', nested: { label: 'World' } } as const;"
  );
  put(
    directory,
    'src/bootstrap/namespace-map.ts',
    "import { exampleTranslations } from 'features/example/pages/example/example.translations';\n" +
      'export const namespaceMap = { example: exampleTranslations };'
  );
  put(directory, 'src/core/routing/routing.model.ts', "export const routePaths = { example: '/example' } as const;");
  put(directory, 'src/graphql/queries/bootstrap.graphql', 'query Bootstrap { status { ...Status } }');
  put(
    directory,
    'src/graphql/fragments/status.fragment.ts',
    "import { gql } from '@apollo/client'; export const status = gql`fragment Status on Status { ok }`;"
  );
  // Declare the external package, as in the real project.
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  manifest.dependencies['@apollo/client'] = '*';
  put(directory, 'package.json', JSON.stringify(manifest));
  put(directory, 'src/graphql/graphql-api-types.ts', 'export const BootstrapDocument = {};');
  put(
    directory,
    'src/graphql/queries/bootstrap.ts',
    "import { BootstrapDocument as gqlDocument } from '../graphql-api-types'; export const document = gqlDocument;"
  );
  put(directory, 'src/cycle-a.ts', "import { b } from './cycle-b'; export function a() { return b; }");
  put(directory, 'src/cycle-b.ts', "import { a } from './cycle-a'; export function b() { return a; }");
  put(directory, 'src/types/global.d.ts', 'declare interface Window { example: string }');
  return directory;
}

test('autotest scope indexes tags, facade/mock modules and cycle-safe static import coverage', () => {
  const directory = fixture();
  try {
    put(directory, 'autotests/playwright/pages/example.ts', 'export class ExamplePage {}');
    put(
      directory,
      'autotests/playwright/helpers/factory.ts',
      'export function createRestMockFactory(value: unknown) { return value; }'
    );
    put(
      directory,
      'autotests/playwright/mocks/example.ts',
      "import { createRestMockFactory } from '../helpers/factory'; " +
        "export const exampleMock = createRestMockFactory({ path: '/api/example' });"
    );
    put(
      directory,
      'autotests/playwright/tests/example.spec.ts',
      "import { ExamplePage } from '../pages/example'; import { exampleMock } from '../mocks/example';" +
        "import '../../../src/cycle-a'; declare const test: Function;" +
        "test('example', { tag: ['@C123', '@smoke'] }, () => [new ExamplePage(), exampleMock]);" +
        "// @C456 is not a tag.\nconst unrelated = '@C789';"
    );
    run(directory, 'generate');
    const scoped = (args: string[]) => query(directory, ['--scope', 'autotests', ...args]);
    assert.equal(scoped(['--testrail', '@C123']).records.length, 1);
    assert.equal(scoped(['--testrail', 'C456']).records.length, 0);
    assert.equal(scoped(['--testrail', 'C789']).records.length, 0);
    assert.equal(scoped(['--facade', 'ExamplePage']).records.length, 2);
    assert.equal(scoped(['--mock', 'exampleMock']).records.length, 2);
    assert.equal(scoped(['--coverage', 'autotests/playwright/helpers/factory.ts']).records.length, 1);
    assert.equal(scoped(['--coverage', 'src/cycle-b.ts']).records.length, 1);
    assert.equal(scoped(['--symbol', 'useExample']).records.length, 0);
    assert.ok(scoped(['--symbol', 'ExamplePage']).records.length);
    assert.equal(scoped(['--facade', 'ExamplePage', '--path', 'autotests/playwright/tests']).records.length, 1);
    run(directory, 'query', ['--scope', 'autotests', '--mock', 'exampleMock', '--strict']);
    for (const args of [
      ['--scope', 'unknown', '--symbol', 'x'],
      ['--testrail', 'C123'],
      ['--scope', 'autotests', '--testrail', 'C0'],
      ['--scope', 'autotests', '--mock', 'x', '--facade', 'y'],
      ['--scope', 'autotests', '--mock', 'x', '--graph', 'imports'],
    ])
      run(directory, 'query', args, false);
    // A normal scoped query loads only its selected graph, even if another is unavailable.
    rmSync(join(directory, '.claude/context-graphs/autotests.testrail.graph.json'));
    assert.equal(scoped(['--mock', 'exampleMock']).records.length, 2);
    run(directory, 'query', ['--scope', 'autotests', '--mock', 'exampleMock', '--strict'], false);
    put(
      directory,
      'autotests/playwright/tests/invalid.spec.ts',
      "declare const test: Function; test('invalid', { tag: '@C0' }, () => {});"
    );
    assert.match(run(directory, 'generate', [], false).stderr, /invalid TestRail tag/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('indexes real relationships, follows aliases/barrels, and answers every selector', () => {
  const directory = fixture();
  try {
    run(directory, 'generate');
    assert.equal(
      readdirSync(join(directory, '.claude/context-graphs')).filter((file) => file.endsWith('.graph.json')).length,
      24
    );
    assert.ok(query(directory, ['--symbol', 'useExample']).records.some((entry) => entry.name === 'useExample'));
    assert.ok(query(directory, ['--defines', 'ExamplePage']).records.length);
    const consumers = query(directory, ['--consumers', 'example']).records;
    assert.ok(consumers.some((entry) => entry.path.endsWith('use-example.hook.ts')));
    assert.ok(
      query(directory, [
        '--depends-on',
        'src/features/example/pages/example/example.page.tsx',
        '--depth',
        '4',
      ]).records.some((entry) => entry.to.endsWith('example.util.ts'))
    );
    assert.ok(
      query(directory, ['--dependents', 'src/shared/utils/example/example.util.ts', '--depth', '4']).records.some(
        (entry) => entry.to.endsWith('example.page.tsx')
      )
    );
    assert.equal(query(directory, ['--depends-on', 'src/cycle-a.ts', '--depth', '50']).records.length, 2);
    assert.equal(query(directory, ['--route', '/example']).records[0].from, 'example');
    assert.ok(query(directory, ['--config', 'build']).records.length);
    assert.equal(query(directory, ['--unit', 'absent']).records.length, 0);
    assert.equal(query(directory, ['--emits', 'absent']).records.length, 0);
    assert.ok(query(directory, ['--path', 'src/shared']).records.length);
    assert.equal(query(directory, ['--symbol', 'useExample', '--path', 'src/features']).records.length, 0);
    assert.ok(query(directory, ['--graph', 'render-flow']).records.some((entry) => entry.name === 'Widget'));
    assert.ok(query(directory, ['--graph', 'data-flow']).records.some((entry) => entry.name === 'example'));
    assert.ok(
      query(directory, ['--graph', 'translations']).records.some((entry) => entry.to === 'example:nested.label')
    );
    assert.ok(query(directory, ['--graph', 'translations']).records.some((entry) => entry.relation === 'uses-key'));
    assert.ok(
      query(directory, ['--graph', 'graphql-operations']).records.some((entry) => entry.relation === 'spreads')
    );
    assert.ok(
      query(directory, ['--graph', 'graphql-usage']).records.some(
        (entry) => entry.to === 'Bootstrap' && entry.relation === 'document-reference'
      )
    );
    assert.ok(query(directory, ['--graph', 'globals']).records.length);
    run(directory, 'query', ['--strict']);
    const before = readFileSync(join(directory, '.claude/context-graphs/index.json'), 'utf8');
    run(directory, 'generate');
    assert.equal(readFileSync(join(directory, '.claude/context-graphs/index.json'), 'utf8'), before);
    // A normal symbol lookup must not open/parse an unrelated graph.
    put(directory, '.claude/context-graphs/routes.graph.json', 'not JSON');
    assert.ok(query(directory, ['--symbol', 'useExample']).records.length);
    assert.match(run(directory, 'query', ['--strict'], false).stderr, /Corrupt/);
    run(directory, 'generate');
    put(directory, 'new-file.md', 'new repository documentation');
    assert.match(run(directory, 'query', ['--strict'], false).stderr, /Stale/);
    run(directory, 'generate');
    rmSync(join(directory, '.claude/context-graphs/imports.graph.json'));
    run(directory, 'query', ['--strict'], false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('invalid inputs, malformed graphs, missing generation, and unresolved imports fail clearly', () => {
  const directory = fixture();
  try {
    run(directory, 'query', ['--help']);
    run(directory, 'query', ['--symbol', 'useExample'], false);
    for (const args of [
      [],
      ['--unknown'],
      ['--symbol'],
      ['--symbol', ''],
      ['--scope', 'autotests'],
      ['--symbol', 'x', '--route', 'y'],
      ['--depth', '2'],
      ['--depends-on', 'x', '--depth', '0'],
      ['--depends-on', 'x', '--depth', '51'],
      ['--depends-on', 'x', '--depth', '1.5'],
      ['--graph', '../../outside'],
    ])
      run(directory, 'query', args, false);
    put(directory, 'src/broken.ts', "import { missing } from './missing'; export { missing };");
    assert.match(run(directory, 'generate', [], false).stderr, /unresolved local import/);
    assert.match(run(directory, 'query', ['--strict'], false).stderr, /unresolved local import/);
    mkdirSync(join(directory, 'src/empty-directory'));
    put(directory, 'src/broken.ts', "import './empty-directory';");
    assert.match(run(directory, 'generate', [], false).stderr, /unresolved local import/);
    put(directory, 'src/broken.ts', 'export const = ;');
    run(directory, 'generate', [], false);
    run(directory, 'query', ['--strict'], false);
    rmSync(join(directory, 'src/broken.ts'));
    run(directory, 'generate');
    run(directory, 'query', ['--path', '../outside'], false);
    run(directory, 'query', ['--depends-on', 'src/cycle-a.ts', '--graph', 'routes'], false);
    put(directory, '.claude/context-graphs/symbols.graph.json', '{}');
    assert.match(run(directory, 'query', ['--symbol', 'useExample'], false).stderr, /Corrupt/);
    run(directory, 'generate');
    put(directory, '.claude/context-graphs/index.json', '{}');
    assert.match(run(directory, 'query', ['--symbol', 'useExample'], false).stderr, /Invalid graph manifest/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('indexes overlapping doc units and literal event candidates without claiming runtime analysis', () => {
  const directory = fixture();
  try {
    put(
      directory,
      'docs/units.map.json',
      JSON.stringify([
        { id: 'shared', kind: 'functionality', title: 'Shared', globs: ['src/shared/**'] },
        { id: 'example', kind: 'feature', title: 'Example', globs: ['src/features/example/**'] },
        { id: 'all', kind: 'infra', title: 'All', globs: ['src/**'] },
      ])
    );
    put(
      directory,
      'src/prefixed.ts',
      "import { useTranslation as translate } from 'react-i18next';" +
        "export function useLabel() { const { t: text } = translate('example', { keyPrefix: 'nested' });" +
        "return text('label'); }"
    );
    put(
      directory,
      'src/analytics.ts',
      "const analytics = { track: (event: string) => event }; analytics.track('opened');"
    );
    run(directory, 'generate');
    assert.ok(
      query(directory, ['--unit', 'example']).records.some(
        (entry) => entry.relation === 'depends-on-unit' && entry.to === 'shared'
      )
    );
    assert.ok(query(directory, ['--unit', 'all']).records.some((entry) => entry.to === 'src/analytics.ts'));
    assert.equal(query(directory, ['--emits', 'opened']).records[0].relation, 'emits-candidate');
    assert.ok(
      query(directory, ['--graph', 'translations']).records.some(
        (entry) => entry.relation === 'uses-key' && entry.to === 'example:nested.label'
      )
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
