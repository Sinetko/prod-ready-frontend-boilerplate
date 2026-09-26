import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
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
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import prompts from 'prompts';
import ts from 'typescript';

import { Kind, buildSchema, parse, validate } from 'graphql';

import { flags } from './lib/cli';

const repository = resolve(__dirname, '..');

function sandbox() {
  const directory = mkdtempSync(join(tmpdir(), 'scaffold-phase6-'));
  for (const item of [
    'src',
    'scripts',
    'package.json',
    'codegen.yml',
    'schema.graphql',
    'tsconfig.json',
    'tsconfig.node.json',
    'tsconfig.vite.json',
    '.prettierrc.js',
    'eslint.config.mjs',
    'graphql.config.ts',
  ]) {
    cpSync(join(repository, item), join(directory, item), { recursive: true });
  }
  symlinkSync(join(repository, 'node_modules'), join(directory, 'node_modules'), 'dir');
  return directory;
}

function command(directory: string, script: string, args: string[], success = true) {
  const result = spawnSync(
    process.execPath,
    [
      join(repository, 'node_modules/tsx/dist/cli.mjs'),
      '--tsconfig',
      join(directory, 'tsconfig.node.json'),
      join(directory, `scripts/${script}.ts`),
      ...args,
    ],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 30000,
    }
  );
  const output = result.stdout + result.stderr;
  if (success) assert.equal(result.status, 0, output);
  else assert.notEqual(result.status, 0, output);
  assert.equal(result.error, undefined, 'Command must finish without waiting for stdin');
  return output;
}

const generators = ['hook', 'util', 'store', 'context', 'component', 'page', 'query', 'fragment'];

function assertArrowFunctions(file: string) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    assert.equal(ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node), false, file);
    ts.forEachChild(node, visit);
  };
  visit(source);
}

test('scaffolders fail fast, clone canonical shapes, preserve edits, and register pages', () => {
  const directory = sandbox();
  try {
    for (const kind of generators) {
      assert.match(command(directory, `generate-${kind}`, ['--non-interactive'], false), /Missing required flags/);
    }
    for (const [kind, parent, name, expected] of [
      [
        'hook',
        'shared/hooks',
        'use-sample-item',
        ['index.ts', 'use-sample-item.hook.ts', 'use-sample-item.types.ts', 'use-sample-item.spec.ts'],
      ],
      ['util', 'shared/utils', 'sample-item', ['index.ts', 'sample-item.util.ts', 'sample-item.spec.ts']],
      ['store', 'core/stores', 'sample-item', ['index.ts', 'sample-item.store.ts', 'sample-item.types.ts']],
      ['context', 'core/contexts', 'sample-item', ['index.ts', 'sample-item.context.tsx', 'sample-item.types.ts']],
      [
        'component',
        'shared/components',
        'sample-item',
        ['index.ts', 'sample-item.component.tsx', 'sample-item.types.ts'],
      ],
    ] as const) {
      const args = ['--non-interactive', '--name', name, '--path', `src/${parent}`];
      command(directory, `generate-${kind}`, args);
      const target = join(directory, 'src', parent, name);
      assert.deepEqual(readdirSync(target).sort(), [...expected].sort());
      for (const file of readdirSync(target)) assertArrowFunctions(join(target, file));
      const original = readFileSync(join(target, 'index.ts'), 'utf8');
      command(directory, `generate-${kind}`, args);
      assert.equal(readFileSync(join(target, 'index.ts'), 'utf8'), original);
      rmSync(join(target, 'index.ts'));
      command(directory, `generate-${kind}`, args);
      assert.equal(readFileSync(join(target, 'index.ts'), 'utf8'), original);
    }
    const pageArgs = [
      '--non-interactive',
      '--name',
      'sample-item',
      '--group',
      'example',
      '--route',
      '/sample-item',
      '--namespace',
      'sample-item',
    ];
    command(directory, 'generate-page', pageArgs);
    command(directory, 'generate-page', pageArgs);
    assert.deepEqual(readdirSync(join(directory, 'src/features/example/pages/sample-item')).sort(), [
      'index.ts',
      'sample-item.page.tsx',
      'sample-item.translations.ts',
    ]);
    assert.match(
      readFileSync(join(directory, 'src/core/routing/routing.model.ts'), 'utf8'),
      /sampleItem: '\/sample-item'/
    );
    const registry = readFileSync(join(directory, 'src/bootstrap/namespace-map.ts'), 'utf8');
    assertArrowFunctions(join(directory, 'src/features/example/pages/sample-item/sample-item.page.tsx'));
    assert.equal((registry.match(/'sample-item':/g) ?? []).length, 1);
    command(
      directory,
      'generate-page',
      pageArgs.map((arg) => (arg === '/sample-item' ? '/different' : arg)),
      false
    );
    const util = join(directory, 'src/shared/utils/sample-item/sample-item.util.ts');
    writeFileSync(util, '// custom edit\n' + readFileSync(util, 'utf8'));
    command(
      directory,
      'generate-util',
      ['--non-interactive', '--name', 'sample-item', '--path', 'src/shared/utils'],
      false
    );
    assert.match(readFileSync(util, 'utf8'), /^\/\/ custom edit/);
    command(directory, 'generate-util', ['--non-interactive', '--name', 'escape', '--path', '../outside'], false);
    symlinkSync(tmpdir(), join(directory, 'src/escape'), 'dir');
    command(directory, 'generate-util', ['--non-interactive', '--name', 'escape', '--path', 'src/escape'], false);
    const types = spawnSync(
      process.execPath,
      [join(repository, 'node_modules/typescript/bin/tsc'), '--noEmit', '--incremental', 'false'],
      { cwd: directory, encoding: 'utf8' }
    );
    assert.equal(types.status, 0, types.stdout + types.stderr);
    const lint = spawnSync(
      process.execPath,
      [join(repository, 'node_modules/eslint/bin/eslint.js'), 'src', '--max-warnings', '0'],
      { cwd: directory, encoding: 'utf8', timeout: 30000 }
    );
    assert.equal(lint.status, 0, lint.stdout + lint.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('page generation rejects namespace reuse by a different translation module before writing files', () => {
  const directory = sandbox();
  try {
    const args = ['--non-interactive', '--group', 'example', '--namespace', 'shared-label'];
    command(directory, 'generate-page', [...args, '--name', 'first-page', '--route', '/first']);
    const registry = join(directory, 'src/bootstrap/namespace-map.ts');
    const before = readFileSync(registry, 'utf8');
    assert.match(
      command(directory, 'generate-page', [...args, '--name', 'second-page', '--route', '/second'], false),
      /Registry.*(import|binding|namespace)/i
    );
    assert.equal(readFileSync(registry, 'utf8'), before);
    assert.equal(existsSync(join(directory, 'src/features/example/pages/second-page')), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('page generation rejects a registry symlink outside src without changing the target', () => {
  const directory = sandbox();
  try {
    const registry = join(directory, 'src/core/routing/routing.model.ts');
    const outside = join(directory, 'outside-routing.ts');
    const before = readFileSync(registry, 'utf8');
    writeFileSync(outside, before);
    rmSync(registry);
    symlinkSync(outside, registry);
    assert.match(
      command(
        directory,
        'generate-page',
        [
          '--non-interactive',
          '--name',
          'linked-page',
          '--group',
          'example',
          '--route',
          '/linked',
          '--namespace',
          'linked',
        ],
        false
      ),
      /symlink|escapes src/
    );
    assert.equal(readFileSync(outside, 'utf8'), before);
    assert.equal(existsSync(join(directory, 'src/features/example/pages/linked-page')), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('scaffolding rejects dangling output symlinks before creating any artefacts', () => {
  const directory = sandbox();
  try {
    const folder = join(directory, 'src/shared/utils/linked-util');
    const outside = join(directory, 'outside-util.ts');
    mkdirSync(folder, { recursive: true });
    symlinkSync(outside, join(folder, 'linked-util.util.ts'));
    assert.match(
      command(
        directory,
        'generate-util',
        ['--non-interactive', '--name', 'linked-util', '--path', 'src/shared/utils'],
        false
      ),
      /dangling symlink/
    );
    assert.equal(existsSync(outside), false);
    assert.deepEqual(readdirSync(folder), ['linked-util.util.ts']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('GraphQL generators validate nested selections, flatten input, run codegen, and extract blocks', () => {
  const directory = sandbox();
  try {
    const schema =
      readFileSync(join(directory, 'schema.graphql'), 'utf8') +
      `
      type Item { id: ID!, label: String!, child: Item, required(arg: Int!): String }
      input SaveInput { label: String!, count: Int! = 2, optional: String }
      type Mutation { save(input: SaveInput!): Item! }
      extend type Query { item(id: ID!): Item!, optional(ids: [ID!], count: Int! = 2): String }
    `;
    writeFileSync(join(directory, 'schema.graphql'), schema);
    for (const [name, field, extra] of [
      ['sample-item', 'item', []],
      ['optional-item', 'optional', []],
      ['lazy-item', 'item', ['--lazy']],
      ['save-item', 'save', ['--mutation']],
    ] as const) {
      command(directory, 'generate-query', ['--non-interactive', '--name', name, '--field', field, ...extra]);
      const folder = extra.includes('--mutation' as never) ? 'mutations' : 'queries';
      assert.deepEqual(
        readdirSync(join(directory, `src/graphql/${folder}/${name}`)).sort(),
        ['index.ts', `${name}.hook.ts`, `${name}.tag.ts`].sort()
      );
      assertArrowFunctions(join(directory, `src/graphql/${folder}/${name}/${name}.hook.ts`));
    }
    command(directory, 'generate-fragment', ['--non-interactive', '--name', 'sample-item', '--type', 'Item']);
    assert.ok(existsSync(join(directory, 'src/graphql/fragments/sample-item.fragment.ts')));
    command(directory, 'generate-query', ['--non-interactive', '--name', 'sample-item', '--field', 'item']);
    command(directory, 'generate-fragment', ['--non-interactive', '--name', 'sample-item', '--type', 'Item']);
    command(
      directory,
      'generate-query',
      ['--non-interactive', '--name', 'sample-item', '--field', 'save', '--mutation'],
      false
    );
    assert.ok(!existsSync(join(directory, 'src/graphql/mutations/sample-item')));
    command(
      directory,
      'generate-query',
      ['--non-interactive', '--name', 'invalid', '--field', 'item', '--lazy', '--mutation'],
      false
    );
    writeFileSync(
      join(directory, 'src/app/scaffold-contract.ts'),
      `
      import { useOptionalItemQuery } from 'graphql/queries/optional-item';
      import { useSampleItemQuery } from 'graphql/queries/sample-item';
      import { useSaveItemMutation } from 'graphql/mutations/save-item';
      export function useScaffoldContract() {
        useOptionalItemQuery();
        // @ts-expect-error Schema requires an id variable.
        useSampleItemQuery();
        useSampleItemQuery({ variables: { id: '1' } });
        const [save] = useSaveItemMutation();
        void save({ variables: { label: 'saved' } });
        // @ts-expect-error Input is flattened into operation variables.
        void save({ variables: { input: { label: 'saved' } } });
      }
    `
    );
    const formatContract = spawnSync(
      process.execPath,
      [join(repository, 'node_modules/prettier/bin/prettier.cjs'), '--write', 'src/app/scaffold-contract.ts'],
      { cwd: directory, encoding: 'utf8' }
    );
    assert.equal(formatContract.status, 0, formatContract.stdout + formatContract.stderr);
    const docs = readFileSync(join(directory, 'src/graphql/documents.graphql'), 'utf8');
    const errors = validate(buildSchema(schema), parse(docs)).filter(
      (error) => !error.message.includes('is never used')
    );
    assert.deepEqual(errors, []);
    const mutation = parse(docs).definitions.find(
      (node) => node.kind === Kind.OPERATION_DEFINITION && node.name?.value === 'SaveItem'
    );
    assert.ok(mutation && mutation.kind === Kind.OPERATION_DEFINITION);
    assert.deepEqual(
      mutation.variableDefinitions?.map((node) => node.variable.name.value),
      ['label', 'count', 'optional']
    );
    assert.match(docs, /\$count: Int! = 2/);
    for (const selector of [
      ['name', 'Item'],
      ['operation', 'SaveItem'],
      ['fragment', 'SampleItem'],
      ['pattern', '^Item$'],
      ['path', 'src/graphql/mutations/**/*.tag.ts'],
      ['ts-type', 'SaveItemMutation'],
    ]) {
      assert.ok(command(directory, 'graphql-extract', [`--${selector[0]}`, selector[1]]).trim());
    }
    command(directory, 'graphql-extract', ['--name', 'Missing'], false);
    command(directory, 'generate-query', ['--non-interactive', '--name', 'invalid', '--field', 'missing'], false);
    assert.ok(!existsSync(join(directory, 'src/graphql/queries/invalid')));
    const types = spawnSync(
      process.execPath,
      [join(repository, 'node_modules/typescript/bin/tsc'), '--noEmit', '--incremental', 'false'],
      { cwd: directory, encoding: 'utf8' }
    );
    assert.equal(types.status, 0, types.stdout + types.stderr);
    const lint = spawnSync(
      process.execPath,
      [join(repository, 'node_modules/eslint/bin/eslint.js'), 'src', '--max-warnings', '0'],
      { cwd: directory, encoding: 'utf8', timeout: 30000 }
    );
    assert.equal(lint.status, 0, lint.stdout + lint.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('interactive prompts collect required values and operation mode; cancellation aborts', async () => {
  const original = process.argv;
  try {
    process.argv = [original[0], original[1]];
    prompts.inject(['hello-world', 'hello', 'lazy']);
    const result = await flags(['name', 'field'], [], true);
    assert.equal(result.name, 'hello-world');
    assert.equal(result.field, 'hello');
    assert.equal(result.lazy, true);
    prompts.inject([new Error('cancel')]);
    await assert.rejects(flags(['name']), /Generation cancelled/);
    process.argv = [...original.slice(0, 2), '--non-interactive', '--name', 'hello'];
    await assert.rejects(flags(['name', 'path']), /--path/);
  } finally {
    process.argv = original;
  }
});
