// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(
  fileURLToPath(new URL('./index.css', import.meta.url)),
  'utf8',
);

describe('prose heading font-family', () => {
  it('applies Source Serif 4 to h1', () => {
    expect(css).toMatch(
      /\.ProseMirror h1\s*\{[^}]*font-family:\s*var\(--crepe-font-title\)/,
    );
  });

  it('applies Source Serif 4 to h2', () => {
    expect(css).toMatch(
      /\.ProseMirror h2\s*\{[^}]*font-family:\s*var\(--crepe-font-title\)/,
    );
  });

  it('applies Source Serif 4 to h3', () => {
    expect(css).toMatch(
      /\.ProseMirror h3\s*\{[^}]*font-family:\s*var\(--crepe-font-title\)/,
    );
  });

  it('applies Source Serif 4 to h4', () => {
    expect(css).toMatch(
      /\.ProseMirror h4\s*\{[^}]*font-family:\s*var\(--crepe-font-title\)/,
    );
  });

  it('applies Source Serif 4 to h5 and h6', () => {
    const h5h6Block = css.slice(css.indexOf('.ProseMirror h5'));
    expect(h5h6Block).toContain('font-family: var(--crepe-font-title)');
  });
});
