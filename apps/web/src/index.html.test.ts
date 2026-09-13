// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(
  fileURLToPath(new URL('../index.html', import.meta.url)),
  'utf8',
);

describe('index.html font loading', () => {
  it('preconnects to Google Fonts', () => {
    expect(html).toContain(
      '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    );
    expect(html).toContain(
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    );
  });

  it('loads Jakarta Sans Plus, Source Serif 4, and IBM Plex Mono', () => {
    expect(html).toMatch(/family=IBM\+Plex\+Mono/);
    expect(html).toMatch(/family=Jakarta\+Sans/);
    expect(html).toMatch(/family=Source\+Serif\+4/);
  });

  it('places font links before the title tag', () => {
    const preconnectIdx = html.indexOf('fonts.googleapis.com');
    const titleIdx = html.indexOf('<title>');
    expect(preconnectIdx).toBeLessThan(titleIdx);
  });
});
