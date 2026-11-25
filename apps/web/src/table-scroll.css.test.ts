import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, 'table-scroll.css'), 'utf8');
const indexCss = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

// Pull the individual rules out of the stylesheet so a minimal fixture can be
// styled without resolving `@import` (the Crepe theme is not available under
// jsdom). jsdom cannot compute every value below (`max-content`, `ch`), so the
// remaining assertions fall back to the extracted rule text.
const wrapperRule = css.match(
  /\.milkdown \.milkdown-table-block \.table-wrapper,\s*\.list-table-scroll\s*\{[^}]*\}/,
);
const tableRule = css.match(
  /\.milkdown \.ProseMirror \.milkdown-table-block table,\s*\.milkdown \.ProseMirror \.list-table-preview\s*\{[^}]*\}/,
);
const cellRule = css.match(
  /\.milkdown \.ProseMirror \.milkdown-table-block :is\(th, td\),\s*\.milkdown \.ProseMirror \.list-table-preview :is\(th, td\)\s*\{[^}]*\}/,
);
const childRule = css.match(
  /\.milkdown \.ProseMirror \.milkdown-table-block :is\(th, td\) > \*,\s*\.milkdown \.ProseMirror \.list-table-preview :is\(th, td\) > \*\s*\{[^}]*\}/,
);

let styleEl: HTMLStyleElement | null = null;
let fixture: HTMLDivElement | null = null;

afterEach(() => {
  styleEl?.remove();
  fixture?.remove();
  styleEl = null;
  fixture = null;
});

/**
 * Injects every extracted table-scroll rule into a `<style>` element and
 * mounts a fixture mirroring both table shapes: a Crepe GFM table inside
 * `.milkdown-table-block > .table-wrapper` and a Quarto `.list-table-preview`,
 * plus a standalone `.list-table-scroll` wrapper.
 *
 * @returns The mounted elements needed by the assertions.
 */
function mountFixture(): {
  wrappers: HTMLElement[];
  tables: HTMLElement[];
  cells: HTMLElement[];
  children: HTMLElement[];
} {
  styleEl = document.createElement('style');
  styleEl.textContent = [wrapperRule, tableRule, cellRule, childRule]
    .map((rule) => rule?.[0] ?? '')
    .join('\n');
  document.head.appendChild(styleEl);

  fixture = document.createElement('div');
  fixture.className = 'milkdown';
  fixture.innerHTML = `
    <div class="ProseMirror">
      <div class="milkdown-table-block">
        <div class="table-wrapper">
          <table><tbody><tr><th><p>head</p></th><td><p>cell</p></td></tr></tbody></table>
        </div>
      </div>
      <table class="list-table-preview"><tbody><tr><th><p>head</p></th><td><p>cell</p></td></tr></tbody></table>
    </div>
    <div class="list-table-scroll"></div>
  `;
  document.body.appendChild(fixture);

  const wrappers = Array.from(
    fixture.querySelectorAll<HTMLElement>('.table-wrapper, .list-table-scroll'),
  );
  const tables = Array.from(
    fixture.querySelectorAll<HTMLElement>('.milkdown-table-block table, .list-table-preview'),
  );
  const cells = Array.from(fixture.querySelectorAll<HTMLElement>('th, td'));
  const children = cells.map((cell) => cell.firstElementChild as HTMLElement);
  return { wrappers, tables, cells, children };
}

describe('table-scroll.css — scrolling wrappers', () => {
  it('defines overflow-x, overflow-y auto and a 70vh max-height on both wrappers', () => {
    expect(wrapperRule).not.toBeNull();
    expect(wrapperRule?.[0]).toMatch(/overflow-x:\s*auto/);
    expect(wrapperRule?.[0]).toMatch(/overflow-y:\s*auto/);
    expect(wrapperRule?.[0]).toMatch(/max-height:\s*70vh/);
  });

  it('computes overflow auto on Crepe and list-table wrappers', () => {
    const { wrappers } = mountFixture();
    expect(wrappers).toHaveLength(2);
    for (const wrapper of wrappers) {
      const style = getComputedStyle(wrapper);
      expect(style.overflowX).toBe('auto');
      expect(style.overflowY).toBe('auto');
    }
  });
});

describe('table-scroll.css — content-sized tables', () => {
  it('overrides the fixed layout with auto, max-content, full min-width and visible overflow', () => {
    expect(tableRule).not.toBeNull();
    expect(tableRule?.[0]).toMatch(/table-layout:\s*auto/);
    expect(tableRule?.[0]).toMatch(/width:\s*max-content/);
    expect(tableRule?.[0]).toMatch(/min-width:\s*100%/);
    expect(tableRule?.[0]).toMatch(/overflow:\s*visible/);
  });

  it('computes table-layout auto and visible overflow on both table shapes', () => {
    const { tables } = mountFixture();
    expect(tables).toHaveLength(2);
    for (const table of tables) {
      const style = getComputedStyle(table);
      expect(style.tableLayout).toBe('auto');
      expect(style.overflow).toBe('visible');
    }
  });
});

describe('table-scroll.css — cell sizing', () => {
  it('gives cells an 8rem minimum width', () => {
    expect(cellRule).not.toBeNull();
    expect(cellRule?.[0]).toMatch(/min-width:\s*8rem/);
  });

  it('caps direct cell children at 40ch', () => {
    expect(childRule).not.toBeNull();
    expect(childRule?.[0]).toMatch(/max-width:\s*40ch/);
  });

  it('defines a rule for every cell in both table shapes', () => {
    const { cells, children } = mountFixture();
    expect(cells).toHaveLength(4);
    expect(children).toHaveLength(4);
    for (const child of children) {
      expect(child).not.toBeNull();
    }
  });
});

describe('index.css — table-scroll import', () => {
  it('imports ./table-scroll.css', () => {
    expect(indexCss).toContain('@import "./table-scroll.css";');
  });

  it('places the import right after the scrollbar import and before tailwind', () => {
    const scrollbar = indexCss.indexOf('@import "./scrollbar.css";');
    const tableScroll = indexCss.indexOf('@import "./table-scroll.css";');
    const tailwind = indexCss.indexOf('@import "tailwindcss";');
    expect(scrollbar).toBeGreaterThan(-1);
    expect(tableScroll).toBeGreaterThan(scrollbar);
    expect(tableScroll).toBeLessThan(tailwind);
  });
});
