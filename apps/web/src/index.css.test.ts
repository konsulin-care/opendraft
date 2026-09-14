import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CSS_PATH = resolve(__dirname, 'index.css');
const css = readFileSync(CSS_PATH, 'utf-8');

describe('index.css — block handle styling', () => {
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

  it('hides the slash command button (first operation-item) in block handle', () => {
    expect(css).toContain('.milkdown-block-handle .operation-item:first-child');
    expect(css).toContain('display: none');
  });

  it('keeps the drag handle visible when data-show is false', () => {
    expect(css).toContain(".milkdown .milkdown-block-handle[data-show='false']");
    expect(css).toContain('opacity: 1');
    expect(css).toContain('pointer-events: auto');
  });
});
