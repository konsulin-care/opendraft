// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(
  fileURLToPath(new URL('./index.css', import.meta.url)),
  'utf8',
);

describe('theme — no cascade layers', () => {
  it('contains zero @layer declarations', () => {
    expect(css).not.toMatch(/^@layer\s+/m);
  });

  it('sets monochrome palette variables under .milkdown', () => {
    expect(css).toContain('--crepe-color-background: #ffffff');
    expect(css).toContain('--crepe-color-on-background: #212529');
    expect(css).toContain('--crepe-color-surface: #ffffff');
    expect(css).toContain('--crepe-color-surface-low: #f8f9fa');
    expect(css).toContain('--crepe-color-on-surface: #212529');
    expect(css).toContain('--crepe-color-on-surface-variant: #6c757d');
    expect(css).toContain('--crepe-color-outline: #adb5bd');
    expect(css).toContain('--crepe-color-primary: #212529');
    expect(css).toContain('--crepe-color-secondary: #dee2e6');
    expect(css).toContain('--crepe-color-hover: #e9ecef');
    expect(css).toContain('--crepe-color-selected: #dee2e6');
    expect(css).toContain('--crepe-color-error: #dc3545');
  });

  it('sets font family variables', () => {
    expect(css).toContain("--crepe-font-default: 'Jakarta Sans'");
    expect(css).toContain("--crepe-font-title: 'Source Serif 4'");
    expect(css).toContain("--crepe-font-code: 'IBM Plex Mono'");
  });

  it('sets responsive font sizes via media queries', () => {
    expect(css).toContain('@media (max-width: 639px)');
    expect(css).toContain('--crepe-base-font-size: 14px');
    expect(css).toContain('@media (min-width: 640px)');
    expect(css).toContain('--crepe-base-font-size: 16px');
    expect(css).toContain('@media (min-width: 1024px)');
    expect(css).toContain('--crepe-base-font-size: 18px');
  });

  it('fixes slash menu padding and prevents horizontal scroll', () => {
    expect(css).toContain('max-width: 320px');
    expect(css).toContain('.milkdown-slash-menu .tab-group');
    expect(css).toContain('padding-left: 16px');
    expect(css).toContain('padding-right: 16px');
    expect(css).toContain('min-width: 0');
  });
});
