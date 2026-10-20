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
  '--color-stone-200: #e7e5e4',
  '--color-stone-300: #d6d3d1',
];

const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

describe('index.css — color token theme', () => {

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

describe('index.css — stone palette tokens', () => {
  it('declares --color-stone-200 with the Tailwind stone value', () => {
    expect(themeBlock).toContain('--color-stone-200: #e7e5e4');
  });

  it('declares --color-stone-300 with the Tailwind stone value', () => {
    expect(themeBlock).toContain('--color-stone-300: #d6d3d1');
  });

  it('resolves every stone utility used by FormattingToolbar to a declared token', () => {
    const toolbar = readFileSync(
      fileURLToPath(
        new URL('./components/FormattingToolbar.tsx', import.meta.url),
      ),
      'utf8',
    );
    const utilities = Array.from(
      toolbar.matchAll(
        /\b(?:bg|text|border|outline|ring|fill|stroke|from|to|via|shadow|placeholder|divide|decoration|accent|caret)-(stone-\w+)/g,
      ),
    ).map((m) => m[1]);
    expect(utilities.length).toBeGreaterThan(0);
    for (const token of utilities) {
      expect(themeBlock, `--color-${token} must be declared`).toContain(
        `--color-${token}:`,
      );
    }
  });
});

describe('theme — crepe color variables reference tokens', () => {
  const crepeColorVars = Object.fromEntries(
    Array.from(css.matchAll(/(--crepe-color-[\w-]+):\s*([^;]+);/g)).map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );

  it('declares every crepe color variable', () => {
    const expected = [
      '--crepe-color-background',
      '--crepe-color-on-background',
      '--crepe-color-surface',
      '--crepe-color-surface-low',
      '--crepe-color-on-surface',
      '--crepe-color-on-surface-variant',
      '--crepe-color-outline',
      '--crepe-color-primary',
      '--crepe-color-secondary',
      '--crepe-color-on-secondary',
      '--crepe-color-inverse',
      '--crepe-color-on-inverse',
      '--crepe-color-hover',
      '--crepe-color-selected',
      '--crepe-color-inline-code',
      '--crepe-color-error',
    ];
    for (const name of expected) {
      expect(crepeColorVars[name], `${name} must be declared`).toBeDefined();
    }
  });

  it('maps --crepe-color-primary to var(--color-black)', () => {
    expect(crepeColorVars['--crepe-color-primary']).toBe('var(--color-black)');
  });

  it('maps every --crepe-color-* entry to a var(--color-*) token', () => {
    for (const [name, value] of Object.entries(crepeColorVars)) {
      expect(value, `${name} must reference a color token`).toMatch(
        /^var\(--color-[\w-]+\)$/,
      );
    }
  });
});

describe('theme — no cascade layers', () => {
  it('contains zero @layer declarations', () => {
    expect(css).not.toMatch(/^@layer\s+/m);
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

describe('index.css — marquee animation', () => {
  it('defines a marquee keyframe that moves text from right to left', () => {
    const keyframes = css.match(/@keyframes\s+marquee\s*\{([\s\S]*?)\n\}/);
    expect(keyframes, '@keyframes marquee must be defined').not.toBeNull();
    const body = keyframes![1];
    expect(body).toMatch(/from\s*\{[^}]*transform:\s*translateX\(0\)/);
    expect(body).toMatch(/to\s*\{[^}]*transform:\s*translateX\(-\d+%\)/);
  });

  it('has a .marquee class that applies the marquee animation', () => {
    const rule = css.match(/\.marquee\s*\{([^}]*)\}/);
    expect(rule, '.marquee class must be defined').not.toBeNull();
    const body = rule![1];
    expect(body).toMatch(/animation:\s*marquee\s+\d+(?:\.\d+)?s/);
    expect(body).toContain('infinite');
  });

  it('disables the marquee animation under prefers-reduced-motion', () => {
    const mediaBlocks =
      css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/g) ??
      [];
    expect(mediaBlocks.length).toBeGreaterThan(0);
    const disablesMarquee = mediaBlocks.some((block) => {
      const rule = block.match(/\.marquee\s*\{([^}]*)\}/);
      return rule !== null && /animation(?:-name)?:\s*none/.test(rule[1]);
    });
    expect(
      disablesMarquee,
      'a prefers-reduced-motion rule must set .marquee animation to none',
    ).toBe(true);
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
