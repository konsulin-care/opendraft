import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CSS_PATH = resolve(__dirname, 'index.css');
const css = readFileSync(CSS_PATH, 'utf-8');

describe('index.css — imports and layers', () => {
  it('contains zero @layer declarations or wrappers', () => {
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

describe('index.css — stock block handle', () => {
  it('does not contain old milkdown-block-handle styles', () => {
    expect(css).not.toContain('.milkdown-block-handle .operation-item:first-child');
    expect(css).not.toContain(".milkdown .milkdown-block-handle[data-show='false']");
  });

  it('hides the stock milkdown-block-handle via display none', () => {
    expect(css).toMatch(/\.milkdown-block-handle\s*\{[^}]*display:\s*none\s*!important/);
  });
});

describe('index.css — block gutter removed', () => {
  it('contains no .block-gutter-container or .block-gutter-handle rules', () => {
    expect(css).not.toContain('.block-gutter-container');
    expect(css).not.toContain('.block-gutter-handle');
  });

  it('hides inactive Crepe table handles with display none', () => {
    expect(css).toMatch(/\.milkdown-table-block \[data-show='false'\]\s*\{[^}]*display:\s*none/);
  });
});
