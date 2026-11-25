// @vitest-environment node
/**
 * Touch bottom sheet layout: the sheet must span the viewport width instead
 * of the user-agent `dialog:modal` `max-width: calc(100% - 6px - 2em)` cap,
 * and must clear the bottom gesture bar.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CSS_PATH = resolve(__dirname, 'index.css');
const css = readFileSync(CSS_PATH, 'utf-8');

describe('index.css — touch bottom sheet', () => {
  it('pins the sheet to the viewport edges', () => {
    expect(css).toMatch(/\.bottom-sheet\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.bottom-sheet\s*\{[^}]*inset-inline:\s*0/);
    expect(css).toMatch(/\.bottom-sheet\s*\{[^}]*bottom:\s*0/);
  });

  it('spans the full width with no max-width cap', () => {
    expect(css).toMatch(/\.bottom-sheet\s*\{[^}]*width:\s*100%/);
    expect(css).toMatch(/\.bottom-sheet\s*\{[^}]*max-width:\s*none/);
  });

  it('clears the bottom gesture bar', () => {
    expect(css).toMatch(
      /\.bottom-sheet\s*\{[^}]*padding-bottom:\s*env\(safe-area-inset-bottom\)/,
    );
  });
});
