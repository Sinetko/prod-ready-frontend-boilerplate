import { defineConfig, mergeConfig } from 'vitest/config';

import common from './src/vite/config/common.ts';

export default mergeConfig(
  common,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.spec.{ts,tsx}'],
      clearMocks: true,
    },
  })
);
