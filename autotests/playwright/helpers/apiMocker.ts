import type { BrowserContext, Route } from '@playwright/test';
import type { MockDefinition } from '../types/mocking';

export class ApiMocker {
  private readonly mocks: MockDefinition[] = [];
  private readonly unexpected: string[] = [];
  private installed = false;

  constructor(private readonly context: BrowserContext) {}

  use(...mocks: MockDefinition[]) {
    this.mocks.push(...mocks.map((mock) => ({ ...mock, response: structuredClone(mock.response) })));
  }

  private readonly handle = async (route: Route) => {
    const request = route.request();
    const mock = [...this.mocks].reverse().find((candidate) => candidate.matches(request));
    if (mock) {
      await route.fulfill({
        status: mock.response.status ?? 200,
        headers: mock.response.headers,
        json: mock.response.body,
      });
      return;
    }
    const path = new URL(request.url()).pathname;
    if (['fetch', 'xhr'].includes(request.resourceType()) || /^\/(api|graphql)(\/|$)/.test(path)) {
      this.unexpected.push(`${request.method()} ${request.url()}`);
      await route.abort('blockedbyclient');
      return;
    }
    await route.fallback();
  };

  async install() {
    if (this.installed) throw new Error('ApiMocker is already installed.');
    await this.context.route('**/*', this.handle);
    this.installed = true;
  }

  verify() {
    if (this.unexpected.length) throw new Error(`Unregistered API requests:\n${this.unexpected.join('\n')}`);
  }

  async dispose() {
    if (this.installed) await this.context.unroute('**/*', this.handle);
    this.installed = false;
  }
}
