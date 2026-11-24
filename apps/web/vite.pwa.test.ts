// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { loadConfigFromFile } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pwaOptions } from './vite.pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = resolve(__dirname, 'vite.config.ts');

/**
 * Flatten a Vite config's plugin entries into their names.
 *
 * @param config - Resolved Vite config.
 * @returns Plugin names, including nested plugin arrays.
 */
function pluginNames(config: Awaited<ReturnType<typeof loadWebConfig>>) {
  return (config?.plugins ?? [])
    .flat()
    .map((plugin) => (plugin as { name?: string }).name);
}

/**
 * Load apps/web/vite.config.ts the way Vite does, for config assertions.
 *
 * @param command - Vite command to configure against.
 * @returns The resolved config, or undefined when loading failed.
 */
async function loadWebConfig(command: 'build' | 'serve') {
  const mode = command === 'build' ? 'production' : 'development';
  const result = await loadConfigFromFile({ command, mode }, CONFIG_PATH);
  return result?.config;
}

describe('pwaOptions', () => {
  it('uses prompt registration without injected register code', () => {
    expect(pwaOptions.registerType).toBe('prompt');
    expect(pwaOptions.injectRegister).toBe(false);
  });

  it('declares the OpenDraft manifest with an svg icon', () => {
    expect(pwaOptions.manifest).toMatchObject({
      id: '/',
      name: 'OpenDraft',
      short_name: 'OpenDraft',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#000000',
      background_color: '#ffffff',
    });
    expect(pwaOptions.manifest?.icons).toEqual([
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ]);
  });
});

/**
 * Assert that the runtime-cache urlPattern matches same-origin /@assets/
 * requests only.
 *
 * @param pattern - The workbox runtime urlPattern to probe.
 */
function expectAssetsUrlPattern(pattern: unknown): void {
  const matches = pattern as (input: {
    url: URL;
    sameOrigin: boolean;
  }) => boolean;
  expect(
    matches({
      url: new URL('https://example.test/@assets/app-123.js'),
      sameOrigin: true,
    }),
  ).toBe(true);
  expect(
    matches({
      url: new URL('https://example.test/src/main.tsx'),
      sameOrigin: true,
    }),
  ).toBe(false);
  expect(
    matches({
      url: new URL('https://cdn.test/@assets/app-123.js'),
      sameOrigin: false,
    }),
  ).toBe(false);
}

describe('pwaOptions.workbox', () => {
  it('precaches the shell while ignoring language chunks and stats output', () => {
    expect(pwaOptions.workbox?.globPatterns).toEqual([
      '**/*.{js,css,html}',
    ]);
    expect(pwaOptions.workbox?.globIgnores).toEqual([
      '**/@assets/lang/**',
      '**/stats.html',
    ]);
    expect(pwaOptions.workbox?.cleanupOutdatedCaches).toBe(true);
    expect(pwaOptions.workbox?.maximumFileSizeToCacheInBytes).toBe(
      3 * 1024 * 1024,
    );
  });

  it('keeps /@api out of the navigate fallback', () => {
    expect(pwaOptions.workbox?.navigateFallback).toBe('index.html');

    const denylist = pwaOptions.workbox?.navigateFallbackDenylist ?? [];
    expect(denylist).toHaveLength(1);
    expect(denylist[0].test('/@api/tree')).toBe(true);
    expect(denylist[0].test('/reader')).toBe(false);
  });

  it('runtime-caches other @assets requests with CacheFirst', () => {
    const routes = pwaOptions.workbox?.runtimeCaching ?? [];
    expect(routes).toHaveLength(1);

    const route = routes[0];
    expect(route.handler).toBe('CacheFirst');
    expect(route.options?.cacheName).toBe('assets');
    expect(route.options?.expiration).toMatchObject({
      maxEntries: 300,
      purgeOnQuotaError: true,
    });
    expect(route.options?.cacheableResponse).toEqual({ statuses: [200] });

    expectAssetsUrlPattern(route.urlPattern);
  });
});

describe('vite.config PWA plugin', () => {
  it('includes vite-plugin-pwa in the build config', async () => {
    const config = await loadWebConfig('build');

    expect(pluginNames(config)).toContain('vite-plugin-pwa');
  });
});
