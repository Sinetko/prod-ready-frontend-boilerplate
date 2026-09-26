import { defineConfig, mergeConfig } from 'vite';

import build from './src/vite/config/build';
import common from './src/vite/config/common';
import dev from './src/vite/config/dev';

export default defineConfig(({ command }) => mergeConfig(common, command === 'serve' ? dev : build));
