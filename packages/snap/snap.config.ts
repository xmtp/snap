import type { SnapConfig } from '@metamask/snaps-cli';

const config: SnapConfig = {
  input: './src/index.ts',
  server: {
    enabled: true,
    port: 8080,
  },
  polyfills: true,
  bundler: 'webpack',
  experimental: {
    wasm: true,
  },
};

export default config;
