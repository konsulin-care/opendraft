import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CSS_PATH = resolve(__dirname, 'index.css');
const css = readFileSync(CSS_PATH, 'utf-8');

describe('index.css — citation dropdown new layout', () => {
  it('has .citation-author with font-weight 600', () => {
    expect(css).toMatch(/\.citation-author\s*\{[^}]*font-weight:\s*600/);
  });

  it('has .citation-year with normal font-weight', () => {
    expect(css).toMatch(/\.citation-year\s*\{[^}]*font-weight:\s*normal/);
  });

  it('has .citation-type with muted color', () => {
    expect(css).toMatch(/\.citation-type\s*\{[^}]*color:\s*var\(--crepe-color-on-surface-variant\)/);
  });

  it('has .citation-type with smaller font size', () => {
    expect(css).toMatch(/\.citation-type\s*\{[^}]*font-size:\s*0\.7rem/);
  });

  it('has .citation-title with muted color', () => {
    expect(css).toMatch(/\.citation-title\s*\{[^}]*color:\s*var\(--crepe-color-on-surface-variant\)/);
  });

  it('has .citation-title with line-clamp 2', () => {
    expect(css).toMatch(/\.citation-title\s*\{[^}]*-webkit-line-clamp:\s*2/);
  });

  it('has .citation-title with display -webkit-box', () => {
    expect(css).toMatch(/\.citation-title\s*\{[^}]*display:\s*-webkit-box/);
  });

  it('does NOT contain old .citation-key rule', () => {
    expect(css).not.toMatch(/\.citation-key\s*\{/);
  });

  it('does NOT contain old .citation-meta rule', () => {
    expect(css).not.toMatch(/\.citation-meta\s*\{/);
  });
});
