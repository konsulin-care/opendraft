import { describe, it, expect } from 'vitest';
import { loadConfigFromFile } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('vite.config', () => {
  it('should bind server to IPv4 localhost for Tailscale compatibility', async () => {
    const result = await loadConfigFromFile(
      { command: 'serve', mode: 'development' },
      resolve(__dirname, 'vite.config.ts'),
    );

    expect(result?.config.server?.host).toBe('127.0.0.1');
  });
});
