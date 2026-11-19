// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { build, createLogger } from 'vite';
import type { Logger, Rollup } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = 'externalized for browser compatibility';
const BYPASS_MARKER = '__vite-browser-external';

/**
 * Builds the web app in memory and collects every sign that a Node built-in
 * reached the browser bundle: Vite's externalization warning, or the Rollup
 * error thrown when a node:* stub is imported by name.
 *
 * @returns Messages emitted by Vite and Rollup during the build.
 */
async function browserBoundaryViolations(): Promise<string[]> {
  const hits: string[] = [];
  const capture = (message: string): void => {
    if (message.includes(MARKER) || message.includes(BYPASS_MARKER)) hits.push(message);
  };

  const logger: Logger = createLogger('warn');
  logger.warn = (message) => capture(String(message));
  logger.warnOnce = (message) => capture(String(message));

  try {
    await build({
      root: WEB_ROOT,
      configFile: resolve(WEB_ROOT, 'vite.config.ts'),
      customLogger: logger,
      logLevel: 'warn',
      build: {
        write: false,
        rollupOptions: {
          onwarn: (warning: Rollup.RollupLog, next) => {
            capture(String(warning.message));
            next(warning);
          },
        },
      },
    });
  } catch (error) {
    hits.push(error instanceof Error ? error.message : String(error));
  }

  return hits;
}

describe('web bundle browser boundary', () => {
  it('does not externalize any node built-in', async () => {
    const hits = await browserBoundaryViolations();
    expect(hits, hits.join('\n')).toEqual([]);
  }, 180_000);
});
