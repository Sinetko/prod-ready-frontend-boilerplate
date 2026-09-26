import type { Page } from '@playwright/test';

export class ExamplePage {
  constructor(private readonly page: Page) {}

  get title() {
    return this.page.getByRole('heading', { name: 'Example', exact: true });
  }

  get count() {
    return this.page.getByText(/^Count: \d+$/);
  }

  get details() {
    return this.page.locator('#example-details');
  }

  async open() {
    await this.page.goto('/example');
  }

  async increment() {
    await this.page.getByRole('button', { name: 'Increment', exact: true }).click();
  }

  async reset() {
    await this.page.getByRole('button', { name: 'Reset', exact: true }).click();
  }

  async toggleDetails() {
    await this.page.getByRole('button', { name: /^(Show|Hide) details$/ }).click();
  }
}
