/**
 * Production build of the API: bundles the server and the workspace packages
 * (which ship as TypeScript sources) into dist/server.js. npm dependencies stay
 * external and are loaded from node_modules at runtime.
 */
import { readdir, readFile, rm } from 'node:fs/promises';
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

/**
 * Vite's `import.meta.glob` for the catalog's JSON files (model knowledge,
 * engine data), which the chat uses on the server: each glob becomes a map of
 * imports, so the files are bundled like in the web app. Only the form used
 * there is supported: `'<dir>/*.json'` with `import: 'default'`.
 *
 * @type {import('esbuild').Plugin}
 */
const importMetaGlob = {
  name: 'import-meta-glob',
  setup(context) {
    context.onLoad(
      { filter: /[\\/]packages[\\/]catalog[\\/]src[\\/][^\\/]+\.ts$/ },
      async (args) => {
        const source = await readFile(args.path, 'utf8');
        if (!source.includes('import.meta.glob')) return undefined;
        const directory = path.dirname(args.path);
        const imports = [];
        const pattern = /import\.meta\.glob(?:<[^>]*>)?\(\s*'([^']+)'\s*,\s*(\{[^}]*\})\s*\)/g;
        const globs = [...source.matchAll(pattern)];
        let contents = source;
        for (const [index, match] of globs.entries()) {
          const [call, glob, options] = match;
          const folder = /^(\.\.?\/[\w./-]*?)\/\*\.json$/.exec(glob)?.[1];
          if (!folder || !/import:\s*'default'/.test(options)) {
            throw new Error(`Unsupported import.meta.glob in ${args.path}: ${call}`);
          }
          const eager = /eager:\s*true/.test(options);
          const files = (await readdir(path.resolve(directory, folder)))
            .filter((file) => file.endsWith('.json'))
            .sort();
          const entries = files.map((file, fileIndex) => {
            const specifier = JSON.stringify(`${folder}/${file}`);
            if (!eager) return `${specifier}: () => import(${specifier}).then((m) => m.default)`;
            const name = `__glob_${index}_${fileIndex}`;
            imports.push(`import ${name} from ${specifier};`);
            return `${specifier}: ${name}`;
          });
          contents = contents.replace(call, `({ ${entries.join(', ')} })`);
        }
        return {
          contents: `${imports.join('\n')}\n${contents}`,
          loader: 'ts',
          resolveDir: directory,
        };
      },
    );
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
  plugins: [externalDependencies, importMetaGlob],
  logLevel: 'info',
});
