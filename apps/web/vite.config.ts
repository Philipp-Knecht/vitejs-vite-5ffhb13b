import { createRequire } from 'node:module';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);
/** react-router only exports its development build; the production build ships alongside it. */
const reactRouterProduction = path.join(
  path.dirname(require.resolve('react-router/package.json')),
  'dist/production/index.mjs',
);

const apiTarget = process.env.KAUFCHECK_API_URL ?? 'http://localhost:3000';
const proxy = { '/api': { target: apiTarget, changeOrigin: false } };

/** A NODE_ENV=development in an .env file would silently produce a development bundle. */
const requireProductionBuild: Plugin = {
  name: 'kaufcheck:require-production-build',
  configResolved(config) {
    if (config.command === 'build' && !config.isProduction) {
      throw new Error(
        'vite build is running in development mode – remove NODE_ENV from your .env file.',
      );
    }
  },
};

export default defineConfig(({ command, isSsrBuild }) => ({
  plugins: [react(), requireProductionBuild],
  resolve: {
    alias:
      command === 'build' && !isSsrBuild
        ? [{ find: /^react-router$/, replacement: reactRouterProduction }]
        : [],
  },
  // One .env for the whole repository; only VITE_* variables reach the browser.
  envDir: '../../',
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: 0,
  },
}));
