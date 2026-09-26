import { test as base, expect } from '@playwright/test';
import { ApiMocker } from '../helpers/apiMocker';

export const test = base.extend<{ apiMocker: ApiMocker }>({
  apiMocker: [
    async ({ context }, use) => {
      const mocker = new ApiMocker(context);
      await mocker.install();
      try {
        await use(mocker);
      } finally {
        try {
          mocker.verify();
        } finally {
          await mocker.dispose();
        }
      }
    },
    { auto: true },
  ],
});

export { expect };
