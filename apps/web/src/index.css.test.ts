import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CSS_PATH = resolve(__dirname, 'index.css');
const css = readFileSync(CSS_PATH, 'utf-8');

describe('index.css — no CSS cascade layers', () => {
  it('contains zero @layer declarations or wrappers', () => {
    // Matches @layer at the start of a line (not inside a comment or @import)
    const layerDeclarations = css.match(/^@layer\s+/gm);
    expect(layerDeclarations).toBeNull();
  });

  it('imports Crepe CSS without layer(...) parameter', () => {
    const crepeImports = css.match(
      /@import\s+["']@milkdown\/crepe\/theme\/[^"']+["']\s+layer\(/gm,
    );
    expect(crepeImports).toBeNull();
  });

  it('retains @import for Crepe common/style.css', () => {
    expect(css).toContain('@import "@milkdown/crepe/theme/common/style.css"');
  });

  it('retains @import for Crepe classic.css', () => {
    expect(css).toContain('@import "@milkdown/crepe/theme/classic.css"');
  });
});
