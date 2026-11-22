// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { loadConfigFromFile } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = resolve(__dirname, 'vite.config.ts');

/**
 * Load apps/web/vite.config.ts the way Vite does, for config assertions.
 * @param command - Vite command to configure against.
 * @returns The resolved config, or undefined when loading failed.
 */
async function loadWebConfig(command: 'build' | 'serve') {
  const mode = command === 'build' ? 'production' : 'development';
  const result = await loadConfigFromFile({ command, mode }, CONFIG_PATH);
  return result?.config;
}

describe('vite.config', () => {
  it('should bind server to IPv4 localhost for Tailscale compatibility', async () => {
    const config = await loadWebConfig('serve');

    expect(config?.server?.host).toBe('127.0.0.1');
  });

  it('should include the Tailwind CSS plugin', async () => {
    const config = await loadWebConfig('serve');

    const pluginNames = (config?.plugins ?? [])
      .flat()
      .map((p) => (p as { name?: string }).name);
    expect(pluginNames.some((name) => name?.includes('tailwind'))).toBe(true);
  });

  it('should build assets under the reserved @assets path', async () => {
    const config = await loadWebConfig('build');

    expect(config?.build?.assetsDir).toBe('@assets');
  });

  it('should proxy /@api to the local BFF while binding 127.0.0.1', async () => {
    const config = await loadWebConfig('serve');

    expect(config?.server?.host).toBe('127.0.0.1');
    expect(config?.server?.proxy?.['/@api']).toMatchObject({
      target: 'http://127.0.0.1:8080',
      changeOrigin: false,
    });
  });

  it('should run tests in the jsdom environment with globals enabled', async () => {
    const config = await loadWebConfig('serve');

    const testOptions = (config as { test?: { environment?: string; globals?: boolean } })
      .test;
    expect(testOptions?.environment).toBe('jsdom');
    expect(testOptions?.globals).toBe(true);
  });

  it('should type the vitest block with vitest defineConfig', () => {
    const source = readFileSync(CONFIG_PATH, 'utf8');

    // A `test` block typed by vite's defineConfig fails tsc with TS2769,
    // because UserConfigExport has no `test` key.
    expect(source).toMatch(/import\s*\{\s*defineConfig\s*\}\s*from\s*['"]vitest\/config['"]/);
  });
});
