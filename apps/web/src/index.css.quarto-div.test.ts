import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

// Extract the rule that hides code-block controls inside quarto-div blocks
// so it can be applied to a fixture without resolving the imported theme CSS.
const quartoDivRule = css.match(
  /\.quarto-div-block \.language-picker\s*,\s*\.quarto-div-block \.language-button\s*\{[^}]*\}/,
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
 * Inject the quarto-div rule into a `<style>` element and mount a minimal
 * fixture mirroring Crepe's code block markup: `.quarto-div-block` wrapping
 * the language picker and language button.
 *
 * @returns The picker and button elements inside the styled fixture.
 */
function mountQuartoDiv(): { picker: HTMLElement; button: HTMLElement } {
  styleEl = document.createElement('style');
  styleEl.textContent = quartoDivRule?.[0] ?? '';
  document.head.appendChild(styleEl);

  fixture = document.createElement('div');
  fixture.className = 'milkdown-code-block quarto-div-block';
  const picker = document.createElement('div');
  picker.className = 'language-picker';
  const button = document.createElement('button');
  button.className = 'language-button';
  fixture.append(picker, button);
  document.body.appendChild(fixture);
  return { picker, button };
}

describe('index.css — quarto-div code block controls', () => {
  it('defines a display none rule for language-picker and language-button', () => {
    expect(quartoDivRule).not.toBeNull();
    expect(quartoDivRule?.[0]).toContain('.language-picker');
    expect(quartoDivRule?.[0]).toContain('.language-button');
    expect(quartoDivRule?.[0]).toMatch(/display:\s*none/);
  });

  it('computes display none for the picker and button inside quarto-div blocks', () => {
    const { picker, button } = mountQuartoDiv();
    expect(getComputedStyle(picker).display).toBe('none');
    expect(getComputedStyle(button).display).toBe('none');
  });
});
