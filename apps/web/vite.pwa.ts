import type { VitePWAOptions } from 'vite-plugin-pwa';

/**
 * PWA configuration for the OpenDraft web app: prompt-based updates, a
 * shell-only precache and a runtime cache for lazily loaded assets.
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  injectRegister: false,
  manifest: {
    id: '/',
    name: 'OpenDraft',
    short_name: 'OpenDraft',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#000000',
    background_color: '#ffffff',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html}'],
    globIgnores: ['**/@assets/lang/**', '**/stats.html'],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/@api\//],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && url.pathname.startsWith('/@assets/'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'assets',
          expiration: {
            maxEntries: 300,
            purgeOnQuotaError: true,
          },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
};
