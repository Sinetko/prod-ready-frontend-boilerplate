import react from '@vitejs/plugin-react-swc';
import { resolve } from 'node:path';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import svgr from 'vite-plugin-svgr';

import type { UserConfig } from 'vite';

const common: UserConfig = {
  resolve: { tsconfigPaths: true },
  plugins: [
    react({
      // The plugin disables .swcrc discovery by default. Explicitly opt in;
      // this callback also enables SWC for production transforms.
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Name defined by the SWC plugin API.
      useAtYourOwnRisk_mutateSwcOptions: (options) => {
        options.swcrc = true;
        options.configFile = resolve(__dirname, '../../../.swcrc');
      },
    }),
    svgr(),
    ViteEjsPlugin({ title: 'Production Ready Frontend Boilerplate' }),
  ],
};

export default common;
