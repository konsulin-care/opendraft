import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { vendorChunk, chunkFileName } from './vite.chunks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: __dirname,
  server: {
    host: '127.0.0.1',
    allowedHosts: ['.ts.net'],
    proxy: {
      '/@api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: false,
      },
    },
  },
  build: {
    assetsDir: '@assets',
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
        chunkFileNames: chunkFileName,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.ANALYZE === '1'
      ? [
          visualizer({
            filename: 'dist/stats.html',
            gzipSize: true,
            template: 'treemap',
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
