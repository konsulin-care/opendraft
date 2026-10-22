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

describe('index.css — shared reading column', () => {
  /** Returns the declaration block text for a top-level selector. */
  const block = (selector: string): string => {
    const start = css.indexOf(selector);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = css.indexOf('}', start);
    return css.slice(start, end);
  };

  it('.reading-column is an 80% centered border-box column with a max-width cap and no horizontal padding', () => {
    const decl = block('.reading-column');
    expect(decl).toMatch(/width:\s*80%/);
    expect(decl).toMatch(/max-width:\s*48rem/);
    expect(decl).toMatch(/margin-inline:\s*auto/);
    expect(decl).toMatch(/box-sizing:\s*border-box/);
    expect(decl).toMatch(/padding-inline:\s*0\s*;/);
  });

  it.each(['.manuscript-editor .editor', '.manuscript-editor .source-editor'])(
    '%s is full width of the column with no horizontal padding and kept vertical padding',
    (selector) => {
      const decl = block(selector);
      expect(decl).toMatch(/width:\s*100%/);
      expect(decl).toMatch(/padding-inline:\s*0\s*;/);
      // Vertical padding is preserved.
      expect(decl).toMatch(/padding-block:/);
    },
  );
});

describe('index.css — editor surfaces align to the reading column', () => {
  /** Returns the declaration block text for a top-level selector. */
  const block = (selector: string): string => {
    const start = css.indexOf(selector);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = css.indexOf('}', start);
    return css.slice(start, end);
  };

  it('leaves equal gutters at 375px and caps the column at 48rem on wide panes', () => {
    const decl = block('.reading-column');
    const widthPct = Number(decl.match(/width:\s*([\d.]+)%/)![1]);
    const maxWidthPx = Number(decl.match(/max-width:\s*([\d.]+)rem/)![1]) * 16;
    const columnAt = (viewport: number) => Math.min((viewport * widthPct) / 100, maxWidthPx);
    expect(columnAt(375)).toBeCloseTo(375 * 0.8);
    expect(columnAt(1920)).toBe(maxWidthPx);
    for (const viewport of [375, 1280, 1920]) {
      const column = columnAt(viewport);
      // margin-inline: auto splits the leftover space evenly.
      const leftGutter = (viewport - column) / 2;
      const rightGutter = viewport - column - leftGutter;
      expect(leftGutter).toBeCloseTo(rightGutter);
    }
  });

  it('keeps source mode on the same column as the visual editor', () => {
    const editorDecl = block('.manuscript-editor .editor');
    const sourceDecl = block('.manuscript-editor .source-editor');
    const grab = (decl: string, prop: string) =>
      decl.match(new RegExp(`${prop}:\\s*([^;]+);`))![1].trim();
    expect(grab(sourceDecl, 'width')).toBe(grab(editorDecl, 'width'));
    expect(grab(sourceDecl, 'box-sizing')).toBe(grab(editorDecl, 'box-sizing'));
    expect(grab(sourceDecl, 'padding-inline')).toBe(grab(editorDecl, 'padding-inline'));
    expect(grab(sourceDecl, 'padding-block')).toBe(grab(editorDecl, 'padding-block'));
  });
});

describe('reading column wiring (source scan)', () => {
  /** Reads a source file relative to apps/web/src. */
  const read = (path: string): string => readFileSync(resolve(__dirname, path), 'utf-8');

  it('EditorSurface renders the panel and both editor surfaces inside .reading-column', () => {
    const surface = read('components/EditorSurface.tsx');
    const columns = surface
      .split('<div className="reading-column">')
      .slice(1)
      .map((segment) => segment.slice(0, segment.indexOf('</div>')));
    expect(columns).toHaveLength(2);
    // Wysiwyg branch: conditional panel + Milkdown inside the column.
    expect(columns[0]).toMatch(/mode === "wysiwyg" && panel/);
    expect(columns[0]).toContain('<Milkdown />');
    // Source branch: conditional panel + SourceEditor inside the column.
    expect(columns[1]).toMatch(/mode === "source" && panel/);
    expect(columns[1]).toContain('<SourceEditor');
  });

  it('FormattingToolbar row carries the shared column class, not a bespoke width', () => {
    const toolbar = read('components/FormattingToolbar.tsx');
    expect(toolbar).toMatch(/className="reading-column[^"]*"/);
    expect(toolbar).not.toContain('w-[80%]');
  });

  it('metadata panel bar and article view carry no px-4', () => {
    expect(read('components/metadata-panel/MetadataPanel.tsx')).not.toContain('px-4');
    expect(read('components/metadata-panel/ArticleView.tsx')).not.toContain('px-4');
  });
});
