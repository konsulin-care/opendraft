// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./index.css', import.meta.url)), 'utf8');

const COMPONENT_CLASSES = [
  'manuscript-workspace',
  'sidebar',
  'workspace-content',
  'block-list',
  'selected',
  'editor-container',
  'metadata-editor',
  'metadata-file',
  'references-editor',
  'section-sidebar',
  'drag-handle',
  'commit-dialog-overlay',
  'commit-dialog',
  'commit-actions',
  'commit-errors',
];

describe('index.css contract', () => {
  it('defines a style block for every component class used in the app', () => {
    for (const cls of COMPONENT_CLASSES) {
      const escaped = cls.replace(/[-.]/g, (c) => `\\${c}`);
      expect(css, `missing style block for .${cls}`).toMatch(new RegExp(`\\.${escaped}\\s*\\{`));
    }
  });

  it('scopes editor content styles to the .tiptap container', () => {
    expect(css).toMatch(/\.tiptap\s*\{/);
    // Nested paragraph and heading rules inside .tiptap (TipTap docs pattern).
    const tiptapBlock = css.slice(css.indexOf('.tiptap'));
    expect(tiptapBlock).toMatch(/p\s*\{/);
    expect(tiptapBlock).toMatch(/h1\s*\{/);
  });

  it('styles the TipTap placeholder', () => {
    expect(css).toMatch(/is-editor-empty/);
  });
});