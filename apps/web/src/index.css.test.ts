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

  it('does not contain old milkdown-block-handle styles', () => {
    expect(css).not.toContain('.milkdown-block-handle .operation-item:first-child');
    expect(css).not.toContain(".milkdown .milkdown-block-handle[data-show='false']");
  });

  it('styles the block-gutter-container', () => {
    expect(css).toContain('.block-gutter-container');
    expect(css).toContain('position: absolute');
    expect(css).toContain('pointer-events: none');
  });

  it('styles the block-gutter-handle', () => {
    expect(css).toContain('.block-gutter-handle');
    expect(css).toContain('cursor: grab');
    expect(css).toContain('pointer-events: auto');
    expect(css).toContain('opacity: 0');
    expect(css).toContain('transition: opacity 0.15s');
  });

  it('shows the block-gutter-handle when data-show is true', () => {
    expect(css).toContain('.block-gutter-handle[data-show="true"]');
    expect(css).toContain('opacity: 1');
  });

  it('adds left padding to editor for gutter space', () => {
    expect(css).toContain('padding: 2rem 1rem 4rem 3rem');
  });
});
