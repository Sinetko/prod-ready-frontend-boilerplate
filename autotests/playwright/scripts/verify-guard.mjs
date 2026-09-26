import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const directory = mkdtempSync(join(tmpdir(), 'playwright-guard-'));
try {
  writeFileSync(
    join(directory, 'playwright.config.ts'),
    `import config from ${JSON.stringify(join(root, 'playwright.config.ts'))};
export default { ...config, testDir: ${JSON.stringify(directory)}, retries: 0,
  reporter: 'line', outputDir: ${JSON.stringify(join(directory, 'results'))} };`
  );
  writeFileSync(
    join(directory, 'negative.spec.ts'),
    `import { test, expect } from ${JSON.stringify(join(root, 'fixtures/fixtures.globalMocker'))};
import { exampleGraphqlMock, exampleRestMock } from ${JSON.stringify(join(root, 'mocks/example'))};
test('unregistered API fails even when the browser catches rejection', async ({ page }) => {
  await page.goto('/example');
  await page.evaluate(() => fetch('/api/unregistered').catch(() => null));
});
test('wrong REST method is not silently mocked', async ({ page, apiMocker }) => {
  apiMocker.use(exampleRestMock());
  await page.goto('/example');
  await page.evaluate(() => fetch('/api/example', { method: 'POST' }).catch(() => null));
});
test('mismatched GraphQL variables fail', async ({ page, apiMocker }) => {
  apiMocker.use(exampleGraphqlMock({ variables: { id: 'expected' } }));
  await page.goto('/example');
  await page.evaluate(() => fetch('/graphql', { method: 'POST',
    body: JSON.stringify({ query: 'query ExampleStatus { status }', variables: { id: 'wrong' } })
  }).catch(() => null));
});
test('malformed GraphQL is not accepted by operationName alone', async ({ page, apiMocker }) => {
  apiMocker.use(exampleGraphqlMock());
  await page.goto('/example');
  await page.evaluate(() => fetch('/graphql', { method: 'POST',
    body: JSON.stringify({ operationName: 'ExampleStatus', query: 'broken' })
  }).catch(() => null));
});
test('mocks from another test cannot leak', async ({ page }) => {
  await page.goto('/example');
  await page.evaluate(() => fetch('/api/example').catch(() => null));
});`
  );
  const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '-c', directory], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.ifError(result.error);
  assert.equal(result.status, 1, output);
  assert.match(output, /5 failed/, output);
  assert.equal((output.match(/Error: Unregistered API requests:/g) ?? []).length, 5, output);
  console.log('All five negative scenarios failed through the real automatic mock fixture as expected.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
