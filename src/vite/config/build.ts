import legacy from '@vitejs/plugin-legacy';
import { compression } from 'vite-plugin-compression2';
import { ViteMinifyPlugin } from 'vite-plugin-minify';

import type { UserConfig } from 'vite';

const build: UserConfig = {
  build: { outDir: 'dist' },
  plugins: [legacy(), ViteMinifyPlugin(), compression()],
};

export default build;
