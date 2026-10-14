import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CSS_PATH = resolve(__dirname, 'index.css');
const css = readFileSync(CSS_PATH, 'utf-8');

describe('index.css — preserved citation styles', () => {
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
});

describe('index.css — citation dropdown new layout', () => {
  it('has .citation-item-body with flex-direction column', () => {
    expect(css).toMatch(/\.citation-item-body\s*\{[^}]*flex-direction:\s*column/);
  });

  it('has .citation-item-body with min-width 0', () => {
    expect(css).toMatch(/\.citation-item-body\s*\{[^}]*min-width:\s*0/);
  });

  it('lets .citation-title wrap (white-space normal, no nowrap)', () => {
    expect(css).toMatch(/\.citation-title\s*\{[^}]*white-space:\s*normal/);
    expect(css).not.toMatch(/\.citation-title\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('has no ellipsis truncation on .citation-title (full title shown)', () => {
    expect(css).not.toMatch(/\.citation-title\s*\{[^}]*text-overflow:\s*ellipsis/);
    expect(css).not.toMatch(/\.citation-title\s*\{[^}]*overflow:\s*hidden/);
  });

  it('has no line-clamp on .citation-title (full title shown)', () => {
    expect(css).not.toMatch(/\.citation-title\s*\{[^}]*-webkit-line-clamp/);
    expect(css).not.toMatch(/\.citation-title\s*\{[^}]*display:\s*-webkit-box/);
  });

  it('widens .milkdown-slash-menu to about 380px', () => {
    expect(css).toMatch(/\.milkdown-slash-menu\s*\{[^}]*max-width:\s*380px/);
  });

  it('keeps item li min-width 0 so rows do not force overflow', () => {
    expect(css).toMatch(/\.menu-groups\s+\.menu-group\s+li\s*\{[^}]*min-width:\s*0/);
  });

  it('gives .citation-doi-input a fixed usable width of 380px', () => {
    expect(css).toMatch(/\.citation-doi-input\s*\{[^}]*width:\s*380px/);
  });

  it('lets the DOI field fill its panel (width 100%)', () => {
    expect(css).toMatch(/\.citation-doi-field\s*\{[^}]*width:\s*100%/);
  });

  it('does NOT contain old .citation-meta rule', () => {
    expect(css).not.toMatch(/\.citation-meta\s*\{/);
  });
});

describe('index.css — citekey pill styling', () => {
  it('has .citekey-link with a background color', () => {
    expect(css).toMatch(/\.citekey-link\s*\{[^}]*background(-color)?:\s*[^;]+/);
  });

  it('has .citekey-link with border-radius', () => {
    expect(css).toMatch(/\.citekey-link\s*\{[^}]*border-radius:\s*[^;]+/);
  });

  it('has .citekey-link with text-decoration none', () => {
    expect(css).toMatch(/\.citekey-link\s*\{[^}]*text-decoration:\s*none/);
  });

  it('has .citekey-link with accent color', () => {
    expect(css).toMatch(/\.citekey-link\s*\{[^}]*color:\s*#2563eb/);
  });

  it('has no .citation-key rule (citekey hidden from dropdown rows)', () => {
    expect(css).not.toMatch(/\.citation-key\s*\{/);
  });
});
