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

describe('index.css — editor column is 80% of the editor pane', () => {
  /** Returns the declaration block text for a top-level selector. */
  const block = (selector: string): string => {
    const start = css.indexOf(selector);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = css.indexOf('}', start);
    return css.slice(start, end);
  };

  it.each(['.manuscript-editor .editor', '.manuscript-editor .source-editor'])(
    '%s is an 80% centered border-box column with no horizontal padding',
    (selector) => {
      const decl = block(selector);
      expect(decl).toMatch(/width:\s*80%/);
      expect(decl).toMatch(/margin-inline:\s*auto/);
      expect(decl).toMatch(/box-sizing:\s*border-box/);
      expect(decl).toMatch(/padding-inline:\s*0\s*;/);
      // Vertical padding is preserved.
      expect(decl).toMatch(/padding-block:/);
    },
  );

  it('leaves equal 10% gutters at 375px, 1280px and 1920px viewport widths', () => {
    const widthPct = Number(
      block('.manuscript-editor .editor').match(/width:\s*([\d.]+)%/)![1],
    );
    for (const viewport of [375, 1280, 1920]) {
      const column = (viewport * widthPct) / 100;
      // margin-inline: auto splits the leftover space evenly.
      const leftGutter = (viewport - column) / 2;
      const rightGutter = leftGutter;
      expect(leftGutter).toBeCloseTo(viewport * 0.1);
      expect(leftGutter).toBeCloseTo(rightGutter);
    }
  });

  it('keeps source mode on the same column as the visual editor', () => {
    const editorDecl = block('.manuscript-editor .editor');
    const sourceDecl = block('.manuscript-editor .source-editor');
    const grab = (decl: string, prop: string) =>
      decl.match(new RegExp(`${prop}:\\s*([^;]+);`))![1].trim();
    expect(grab(sourceDecl, 'width')).toBe(grab(editorDecl, 'width'));
    expect(grab(sourceDecl, 'margin-inline')).toBe(grab(editorDecl, 'margin-inline'));
    expect(grab(sourceDecl, 'box-sizing')).toBe(grab(editorDecl, 'box-sizing'));
    expect(grab(sourceDecl, 'padding-inline')).toBe(grab(editorDecl, 'padding-inline'));
  });
});
