/**
 * Production build of the API: bundles the server and the workspace packages
 * (which ship as TypeScript sources) into dist/server.js. npm dependencies stay
 * external and are loaded from node_modules at runtime.
 */
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(root, 'dist');

/** @type {import('esbuild').Plugin} */
const externalDependencies = {
  name: 'external-dependencies',
  setup(context) {
    context.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.kind === 'entry-point' || args.path.startsWith('@kaufcheck/')) return undefined;
      return { path: args.path, external: true };
    });
  },
};

await rm(outdir, { recursive: true, force: true });
await build({
  entryPoints: [path.join(root, 'src/server.ts')],
  outfile: path.join(outdir, 'server.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  legalComments: 'none',
  plugins: [externalDependencies],
  logLevel: 'info',
});
