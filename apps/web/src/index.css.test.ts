// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./index.css', import.meta.url)), 'utf8');

const COMPONENT_CLASSES = [
  'manuscript-editor',
  'commit-dialog-overlay',
  'commit-dialog',
  'commit-actions',
  'commit-errors',
];

const REMOVED_CHROME = [
  'sidebar',
  'workspace-content',
  'manuscript-page',
  'block-rail',
  'rail-row',
  'draft-badge',
  'metadata-editor',
  'references-editor',
];

describe('index.css contract', () => {
  it('defines a style block for every component class used in the app', () => {
    for (const cls of COMPONENT_CLASSES) {
      const escaped = cls.replace(/[-.]/g, (c) => `\\${c}`);
      expect(css, `missing style block for .${cls}`).toMatch(new RegExp(`\\.${escaped}\\s*\\{`));
    }
  });

  it('scopes editor content styles to the manuscript editor container', () => {
    expect(css).toMatch(/\.manuscript-editor\s*\{/);
    const editorBlock = css.slice(css.indexOf('.manuscript-editor'));
    expect(editorBlock).toMatch(/ProseMirror p\s*\{/);
    expect(editorBlock).toMatch(/ProseMirror h1\s*\{/);
  });

  it('makes the editor own its scroll region', () => {
    expect(css).toMatch(/\.manuscript-editor \.milkdown\s*\{[^}]*overflow-y:\s*auto/);
  });

  it('constrains the editor to a reading-width column', () => {
    expect(css).toMatch(/\.manuscript-editor \.editor\s*\{[^}]*max-width:\s*46rem/);
  });

  it('drops the app-level placeholder rule in favor of Crepe', () => {
    expect(css).not.toContain('is-empty');
  });

  it('provides a heading scale for prose', () => {
    expect(css).toMatch(/ProseMirror h2\s*\{/);
  });

  it('no longer styles removed workspace chrome', () => {
    for (const cls of REMOVED_CHROME) {
      expect(css, `still styles removed class ${cls}`).not.toContain(cls);
    }
  });
});