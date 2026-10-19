// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(
  fileURLToPath(new URL('./index.css', import.meta.url)),
  'utf8',
);

const expectedTokens = [
  '--color-black: #212529',
  '--color-white: #ffffff',
  '--color-surface-low: #f8f9fa',
  '--color-hover: #e9ecef',
  '--color-outline: #adb5bd',
  '--color-secondary: #dee2e6',
  '--color-muted: #6c757d',
  '--color-inline-code: #495057',
  '--color-inverse: #343a40',
  '--color-error: #dc3545',
  '--color-selection: #d0d7de',
  '--color-active-line: #f2f2f2',
  '--color-gutter-bg: #f7f7f7',
  '--color-editor-dark: #282c34',
  '--color-amber-100: #fef3c7',
  '--color-amber-500: #f59e0b',
  '--color-amber-800: #92400e',
  '--color-yellow-200: #fef9c3',
  '--color-slate-800: #1e293b',
  '--color-blue-600-10: rgba(37, 99, 235, 0.1)',
  '--color-blue-600-18: rgba(37, 99, 235, 0.18)',
  '--color-black-08: rgba(0, 0, 0, 0.08)',
  '--color-gray-50: #f9fafb',
  '--color-gray-100: #f3f4f6',
  '--color-gray-200: #e5e7eb',
  '--color-gray-300: #d1d5db',
  '--color-gray-400: #9ca3af',
  '--color-gray-500: #6b7280',
  '--color-gray-600: #4b5563',
  '--color-gray-700: #374151',
  '--color-gray-800: #1f2937',
  '--color-gray-900: #111827',
  '--color-blue-50: #eff6ff',
  '--color-blue-600: #2563eb',
  '--color-blue-700: #1d4ed8',
  '--color-red-50: #fef2f2',
  '--color-red-300: #fca5a5',
  '--color-red-600: #dc3545',
  '--color-red-700: #b91c1c',
  '--color-red-800: #991b1b',
  '--color-green-700: #15803d',
  '--color-sky-600: #0284c7',
];

describe('index.css — color token theme', () => {
  const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

  it('resets all default color tokens so only declared tokens exist', () => {
    expect(themeBlock).toContain('--color-*: initial');
  });

  it('has an @theme block', () => {
    expect(themeBlock).not.toBe('');
  });

  it('resolves --color-black to #212529', () => {
    expect(themeBlock).toContain('--color-black: #212529');
  });

  it('resolves --color-white to #ffffff', () => {
    expect(themeBlock).toContain('--color-white: #ffffff');
  });

  it('declares every expected token with today\'s values', () => {
    for (const token of expectedTokens) {
      expect(themeBlock).toContain(token);
    }
  });
});

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

describe('index.css — editor focus and blockquote styling', () => {
  it('does not apply focus-visible outline to contenteditable elements', () => {
    // The [contenteditable] selector must not appear in the focus-visible rule
    const focusVisibleBlock = css.match(
      /(?:button|textarea)[^}]*focus-visible[^}]*}/s,
    );
    if (focusVisibleBlock) {
      expect(focusVisibleBlock[0]).not.toContain('[contenteditable');
    }
  });

  it('does not apply border-left to blockquotes (avoids double border)', () => {
    const blockquoteRule = css.match(
      /\.manuscript-editor\s+\.ProseMirror\s+blockquote\s*\{[^}]+\}/,
    );
    expect(blockquoteRule).not.toBeNull();
    expect(blockquoteRule![0]).not.toContain('border-l-4');
    expect(blockquoteRule![0]).not.toContain('border-stone-300');
  });
});
