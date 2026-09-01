import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Alias so root tests can import scripts/protocol-manifest.ts as a module
    // (Vitest does not transform cross-directory TS files outside packages).
    alias: {
      '@protocol-manifest': fileURLToPath(new URL('./scripts/protocol-manifest.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});