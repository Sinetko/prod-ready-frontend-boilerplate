import { test, expect } from '../fixtures/fixtures.globalMocker';
import { ExamplePage } from '../pages/example';

test('example count can be incremented and reset', async ({ page }) => {
  const example = new ExamplePage(page);
  await example.open();
  await expect(example.title).toBeVisible();
  await expect(example.count).toHaveText('Count: 0');
  await example.increment();
  await expect(example.count).toHaveText('Count: 1');
  await example.reset();
  await expect(example.count).toHaveText('Count: 0');
});

test('example details can be shown and hidden', async ({ page }) => {
  const example = new ExamplePage(page);
  await example.open();
  await expect(example.details).toBeHidden();
  await example.toggleDetails();
  await expect(example.details).toBeVisible();
  await example.toggleDetails();
  await expect(example.details).toBeHidden();
});
