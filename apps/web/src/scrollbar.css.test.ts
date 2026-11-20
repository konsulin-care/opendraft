// @vitest-environment node
/**
 * Scrollbar stylesheet checks.
 *
 * jsdom cannot render scrollbars, so the contract's CSS is asserted as text:
 * the import wiring, the hidden-at-rest defaults and the attribute that
 * reveals the thumb.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (name: string): string => readFileSync(resolve(__dirname, name), 'utf-8');
const css = read('scrollbar.css');
const indexCss = read('index.css');

/** Index of the first match of `pattern`, or -1. */
const indexOf = (pattern: RegExp): number => indexCss.search(pattern);

describe('index.css — scrollbar import', () => {
  it('imports ./scrollbar.css without layer()', () => {
    expect(indexCss).toContain('@import "./scrollbar.css";');
    expect(indexCss).not.toMatch(/@import\s+["']\.\/scrollbar\.css["']\s+layer\(/);
  });

  it('places the scrollbar import before the tailwind import', () => {
    expect(indexOf(/@import\s+["']\.\/scrollbar\.css["']/)).toBeGreaterThan(-1);
    expect(indexOf(/@import\s+["']\.\/scrollbar\.css["']/)).toBeLessThan(
      indexOf(/@import\s+["']tailwindcss["']/),
    );
  });
});

describe('scrollbar.css — hidden at rest', () => {
  it('registers the --scrollbar-thumb custom property as a color', () => {
    expect(css).toMatch(/@property\s+--scrollbar-thumb\s*\{[^}]*syntax:\s*'<color>'/);
    expect(css).toMatch(/@property\s+--scrollbar-thumb\s*\{[^}]*initial-value:\s*transparent/);
  });

  it('applies a thin transparent scrollbar to every element inside @layer base', () => {
    const layer = css.slice(css.indexOf('@layer base'));
    expect(layer).toMatch(/\*\s*\{[^}]*--scrollbar-thumb:\s*transparent/);
    expect(layer).toMatch(/\*\s*\{[^}]*scrollbar-width:\s*thin/);
    expect(layer).toMatch(/\*\s*\{[^}]*scrollbar-color:\s*var\(--scrollbar-thumb\)\s+transparent/);
  });
});

describe('scrollbar.css — revealed while scrolling', () => {
  it('shows the theme outline color on [data-scrolling]', () => {
    expect(css).toMatch(/\[data-scrolling\][^{]*\{[^}]*--scrollbar-thumb:\s*var\(--color-outline\)/);
  });

  it('uses theme variables only, never raw colors', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgba?\(/);
  });
});
