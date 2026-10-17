import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

// Extract the override rule that hides inactive Crepe table handles so it can
// be applied to a fixture without dragging in the rest of the stylesheet
// (the @import'ed Crepe theme CSS is not resolvable under jsdom).
const tableHandleRule = css.match(
  /\.milkdown \.milkdown-table-block \[data-show='false'\]\s*\{[^}]*\}/,
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
 * Injects the inactive-table-handle rule into a `<style>` element and mounts a
 * minimal fixture mirroring Crepe's table block markup: `.milkdown` wrapping
 * `.milkdown-table-block` with a drag/line handle carrying `data-show`.
 *
 * @param dataShow - The `data-show` attribute value for the handle element.
 * @returns The mounted handle element inside the styled fixture.
 */
function mountHandle(dataShow: 'true' | 'false'): HTMLElement {
  styleEl = document.createElement('style');
  styleEl.textContent = tableHandleRule?.[0] ?? '';
  document.head.appendChild(styleEl);

  fixture = document.createElement('div');
  fixture.className = 'milkdown';
  const tableBlock = document.createElement('div');
  tableBlock.className = 'milkdown-table-block';
  const handle = document.createElement('div');
  handle.className = 'handle';
  handle.setAttribute('data-show', dataShow);
  tableBlock.appendChild(handle);
  fixture.appendChild(tableBlock);
  document.body.appendChild(fixture);
  return handle;
}

describe('index.css — inactive Crepe table handles', () => {
  it('defines a display none override for data-show=false handles', () => {
    expect(tableHandleRule).not.toBeNull();
    expect(tableHandleRule?.[0]).toMatch(/display:\s*none/);
  });

  it('computes display none for handles with data-show=false', () => {
    const hidden = mountHandle('false');
    expect(getComputedStyle(hidden).display).toBe('none');
  });

  it('keeps handles with data-show=true visible', () => {
    const visible = mountHandle('true');
    expect(getComputedStyle(visible).display).not.toBe('none');
  });
});
