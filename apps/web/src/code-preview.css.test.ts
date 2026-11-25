import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CSS_PATH = resolve(__dirname, 'code-preview.css');
const css = readFileSync(CSS_PATH, 'utf8');
const INDEX_CSS = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

// The focus rule keeps a preview-only block's source visible while the user
// types, so it can be applied to a fixture without resolving theme imports.
const focusRule = css.match(
  /\.milkdown \.milkdown-code-block \.codemirror-host\.hidden:focus-within\s*\{[^}]*\}/,
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
 * Inject the focus rule into a `<style>` element and mount a minimal fixture
 * mirroring a preview-only code block: `.milkdown` wrapping
 * `.milkdown-code-block` whose `.codemirror-host` carries `hidden`.
 *
 * @returns The hidden source host and a focusable child inside it.
 */
function mountHiddenHost(): { host: HTMLElement; child: HTMLElement } {
  styleEl = document.createElement('style');
  styleEl.textContent = focusRule?.[0] ?? '';
  document.head.appendChild(styleEl);

  fixture = document.createElement('div');
  fixture.className = 'milkdown';
  const block = document.createElement('div');
  block.className = 'milkdown-code-block';
  const host = document.createElement('div');
  host.className = 'codemirror-host hidden';
  const child = document.createElement('div');
  child.setAttribute('tabindex', '0');
  host.appendChild(child);
  block.appendChild(host);
  fixture.appendChild(block);
  document.body.appendChild(fixture);
  return { host, child };
}

describe('code-preview.css — focused source outweighs preview-only hiding', () => {
  it('keeps a hidden code-block source host displayed while it contains focus', () => {
    const { host, child } = mountHiddenHost();
    child.focus();
    expect(host.matches(':focus-within')).toBe(true);
    expect(focusRule?.[0]).toMatch(/display:\s*block/);
    expect(getComputedStyle(host).display).toBe('block');
  });

  it('index.css imports code-preview.css with the other local imports', () => {
    expect(INDEX_CSS).toContain('@import "./code-preview.css";');
  });
});
