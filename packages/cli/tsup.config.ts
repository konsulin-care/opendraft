import { defineConfig } from 'tsup';

/**
 * Bundle the CLI into a single self-contained ESM file.
 *
 * Everything the CLI needs at runtime (workspace `@opendraft/*` packages
 * and `yaml`) is inlined so the published tarball — which declares no
 * runtime dependencies — runs standalone. Node built-ins stay external
 * via `platform: 'node'`, and the banner prepends the executable shebang
 * to `dist/index.js`.
 *
 * @returns tsup configuration for the `opendraft` bin entry.
 */
export default defineConfig({
  entry: { index: 'src/index.ts' },
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  bundle: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);",
  },
  noExternal: [/@opendraft\//, /^yaml$/],
});
