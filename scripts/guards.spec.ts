import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { apollo, boundaries, hookNames } from './guards/code';
import { coverage, engines, icons } from './guards/repository';
import { translations } from './guards/translations';

const root = process.cwd();
function put(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
function fixture(run: () => void) {
  const directory = mkdtempSync(join(tmpdir(), 'guard-test-'));
  process.chdir(directory);
  try {
    put('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: 'src', moduleResolution: 'node' } }));
    run();
  } finally {
    process.chdir(root);
    rmSync(directory, { recursive: true, force: true });
  }
}
function git(...args: string[]) {
  return execFileSync('git', args, { stdio: 'pipe' });
}
function resources() {
  put(
    'src/features/example/example.translations.ts',
    "export const copy = { title: 'Title', nested: { yes: 'Yes' } } as const;"
  );
  put(
    'src/bootstrap/namespace-map.ts',
    "import { copy } from '../features/example/example.translations'; export const namespaceMap = { example: copy };"
  );
}

test('boundaries resolve relative imports, re-exports, dynamic imports, and type imports', () =>
  fixture(() => {
    put('src/features/a/index.ts', 'export const a = 1;');
    put('src/features/b/index.ts', "export { a } from '../a';");
    put(
      'src/shared/bad.ts',
      "export { a } from '../features/a'; const a = import('features/a'); type A = import('features/a');"
    );
    assert.equal(boundaries().length, 4);
    put('src/shared/bad.spec.ts', "import { a } from 'features/a';");
    assert.equal(boundaries().length, 4);
  }));
test('generic and composition dependencies pass', () =>
  fixture(() => {
    put('src/shared/a.ts', 'export const a = 1;');
    put('src/features/a/index.ts', "export { a } from 'shared/a';");
    put('src/app/index.ts', "import 'features/a';");
    assert.deepEqual(boundaries(), []);
  }));
test('Apollo guard catches aliases, re-exports, namespace and require bypasses', () =>
  fixture(() => {
    put(
      'src/app/bad.ts',
      "import { useQuery as renamed } from '@apollo/client/react'; " +
        "export { useMutation as x } from '@apollo/client/react'; " +
        "import * as Apollo from '@apollo/client'; const a = require('@apollo/client/react');"
    );
    assert.equal(apollo().length, 4);
  }));
test('Apollo type-only imports and exact wrapper exception pass', () =>
  fixture(() => {
    put(
      'src/app/good.ts',
      "import type { useQuery } from '@apollo/client/react'; import { type useMutation, gql } from '@apollo/client';"
    );
    put(
      'src/graphql/hooks/use-apollo-query/use-apollo-query.hook.ts',
      "import { useQuery } from '@apollo/client/react';"
    );
    assert.deepEqual(apollo(), []);
    put(
      'src/graphql/hooks/use-apollo-query/use-apollo-query.hook.ts',
      "import { useMutation } from '@apollo/client/react';"
    );
    assert.equal(apollo().length, 1);
  }));
test('GraphQL hook names match folder and operation kind', () =>
  fixture(() => {
    put('src/graphql/queries/get-user/get-user.hook.ts', 'export function useGetUserLazyQuery() {}');
    put('src/graphql/mutations/save-user/save-user.hook.ts', 'export const useSaveUserMutation = () => {};');
    assert.deepEqual(hookNames(), []);
    put('src/graphql/mutations/save-user/save-user.hook.ts', 'export function useSaveUserQuery() {}');
    assert.equal(hookNames().length, 1);
    put('src/graphql/queries/get-user/get-user.hook.ts', 'export function useWrongQuery() {}');
    assert.equal(hookNames().length, 2);
  }));
test('engine pins use real semver and packageManager must agree', () =>
  fixture(() => {
    const manifest = {
      engines: { node: '>=24 <25', npm: '12.x' },
      volta: { node: '24.21.0', npm: '12.1.0' },
      packageManager: 'npm@12.1.0',
    };
    put('package.json', JSON.stringify(manifest));
    assert.deepEqual(engines(), []);
    manifest.volta.node = '25.0.0';
    manifest.packageManager = 'npm@11.0.0';
    put('package.json', JSON.stringify(manifest));
    assert.equal(engines().length, 2);
  }));
test('icons accept imports with query suffixes, URLs, and CSS references', () =>
  fixture(() => {
    for (const name of ['imported', 'url', 'css', 'unused']) put(`src/assets/icons/${name}.svg`, '<svg/>');
    put(
      'src/app/a.ts',
      "import Icon from 'assets/icons/imported.svg?react'; " +
        "const url = new URL('../assets/icons/url.svg', import.meta.url);"
    );
    put('src/app/style.css', "a { background: url('../assets/icons/css.svg'); }");
    assert.deepEqual(icons(), ['src/assets/icons/unused.svg: unused icon; add a static reference or remove it.']);
  }));
test('shared coverage includes untracked files and requires an executable importing test', () =>
  fixture(() => {
    git('init', '-q');
    put('src/shared/utils/a/a.util.ts', 'export const a = 1;');
    put('src/shared/utils/a/index.ts', "export { a } from './a.util';");
    assert.equal(coverage([]).length, 1);
    put('src/shared/utils/a/a.spec.ts', "import { a } from './index'; test.skip('a', () => {});");
    assert.equal(coverage([]).length, 1);
    put('src/shared/utils/a/a.spec.ts', "import { a } from './index'; test('a', () => {});");
    assert.deepEqual(coverage([]), []);
    assert.throws(() => coverage(['--base']), /Usage/);
    assert.throws(() => coverage(['--base', 'nonexistent']));
  }));
test('shared coverage supports merge-base comparison and ignores deletions', () =>
  fixture(() => {
    git('init', '-q');
    put('src/shared/a.util.ts', 'export const a = 1;');
    git('add', '.');
    git('-c', 'user.name=Guard Test', '-c', 'user.email=guard@example.invalid', 'commit', '-qm', 'base');
    put('src/shared/a.util.ts', 'export const a = 2;');
    assert.equal(coverage(['--base', 'HEAD']).length, 1);
    rmSync('src/shared/a.util.ts');
    assert.deepEqual(coverage(['--base', 'HEAD']), []);
  }));
test('shared coverage does not count type-only barrel exports as runtime imports', () =>
  fixture(() => {
    git('init', '-q');
    put('src/shared/utils/a/a.util.ts', 'export const a = () => 1;');
    put('src/shared/utils/a/marker.types.ts', 'export const marker = 1;');
    const marker = "export { marker } from './marker.types';";
    put('src/shared/utils/a/index.ts', marker + "export type { a } from './a.util';");
    put('src/shared/utils/a/a.spec.ts', "import { marker } from './index'; test('unrelated', () => marker);");
    assert.equal(coverage([]).length, 1);
    put('src/shared/utils/a/index.ts', marker + "export { type a } from './a.util';");
    assert.equal(coverage([]).length, 1);
    put('src/shared/utils/a/index.ts', "export { a } from './a.util';");
    put('src/shared/utils/a/a.spec.ts', "import { a } from './index'; test('a', () => a());");
    assert.deepEqual(coverage([]), []);
  }));
test('translations resolve registry imports, aliases, conditional keys, and prefixes', () =>
  fixture(() => {
    resources();
    put(
      'src/app/a.ts',
      "import { useTranslation as useCopy } from 'react-i18next'; " +
        "function A(){const { t: text } = useCopy('example'); " +
        "text(true ? 'title' : 'nested.yes');} function B(){const {t} = useCopy('example', {keyPrefix: 'nested'}); " +
        "t('yes');}"
    );
    assert.deepEqual(translations(), []);
  }));
test('translations flag missing keys and namespaces with symbol-specific scope', () =>
  fixture(() => {
    resources();
    put(
      'src/app/a.ts',
      "import { useTranslation } from 'react-i18next'; " +
        "function A(){const {t} = useTranslation('example'); " +
        "t('missing');} function B(){const {t} = useTranslation('absent'); t('title');}"
    );
    assert.equal(translations().length, 3, JSON.stringify(translations()));
  }));
test('translations catch duplicate keys before JavaScript overwrites them', () =>
  fixture(() => {
    resources();
    put('src/features/example/example.translations.ts', "export const copy = { title: 'one', title: 'two' };");
    assert.ok(translations().some((issue) => issue.includes('duplicate translation key title')));
  }));
test('all guard CLIs return failure on invalid options', () =>
  fixture(() => {
    for (const name of [
      'import-from-src',
      'apollo-hooks',
      'graphql-hook-naming',
      'changed-shared-coverage',
      'used-icons',
      'engines-versions',
      'problem-translation-keys',
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          resolve(root, 'node_modules/tsx/dist/cli.mjs'),
          '--tsconfig',
          resolve(root, 'tsconfig.node.json'),
          resolve(root, `scripts/check-${name}.ts`),
          '--invalid',
        ],
        { encoding: 'utf8' }
      );
      assert.equal(result.status, 1, `${name}: ${result.stderr}`);
      assert.match(result.stderr, /flags|Usage/);
    }
  }));

test('every CLI returns zero for a valid fixture and nonzero for its violation', () => {
  const cases = [
    ['import-from-src', 'src/shared/bad.ts', "import 'features/example/example.translations';"],
    ['apollo-hooks', 'src/app/bad.ts', "import { useQuery } from '@apollo/client/react';"],
    ['graphql-hook-naming', 'src/graphql/queries/a/a.hook.ts', 'export function useWrongQuery() {}'],
    ['changed-shared-coverage', 'src/shared/a.util.ts', 'export const a = 1;'],
    ['used-icons', 'src/assets/icons/unused.svg', '<svg/>'],
    ['engines-versions', 'package.json', '{}'],
    [
      'problem-translation-keys',
      'src/app/bad.ts',
      "import { useTranslation } from 'react-i18next';" +
        " function A(){ const {t} = useTranslation('example'); t('missing'); }",
    ],
  ];
  for (const [name, path, content] of cases)
    fixture(() => {
      git('init', '-q');
      resources();
      put(
        'package.json',
        JSON.stringify({
          engines: { node: '24.x', npm: '12.x' },
          volta: { node: '24.21.0', npm: '12.1.0' },
          packageManager: 'npm@12.1.0',
        })
      );
      const run = () =>
        spawnSync(
          process.execPath,
          [
            resolve(root, 'node_modules/tsx/dist/cli.mjs'),
            '--tsconfig',
            resolve(root, 'tsconfig.node.json'),
            resolve(root, `scripts/check-${name}.ts`),
          ],
          { encoding: 'utf8' }
        );
      const good = run();
      assert.equal(good.status, 0, `${name}: ${good.stderr}`);
      put(path, content);
      const bad = run();
      assert.equal(bad.status, 1, `${name}: ${bad.stdout} ${bad.stderr}`);
      assert.ok(bad.stderr.length > 0);
    });
});

test('translation dynamic branches and missing namespace overrides fail explicitly', () =>
  fixture(() => {
    resources();
    put(
      'src/app/a.ts',
      "import { useTranslation } from 'react-i18next';" +
        " function A(){const {t} = useTranslation('example'); t(flag ? 'title' : key); t('title', {ns: 'missing'});}"
    );
    assert.ok(translations().some((issue) => issue.includes('must be literals')));
    assert.ok(translations().some((issue) => issue.includes('missing:title')));
  }));
