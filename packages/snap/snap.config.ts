import type { SnapConfig } from '@metamask/snaps-cli';
import { merge } from '@metamask/snaps-cli';

const config: SnapConfig = {
  input: './src/index.ts',
  server: {
    enabled: true,
    port: 8080,
  },
  polyfills: true,
  bundler: 'webpack',
  customizeWebpackConfig: (existing) =>
    merge(existing, {
      module: {
        rules: [
          {
            test: /\.wasm$/u,
            type: 'asset/inline',
          },
        ],
      },
    }),
};

export default config;
