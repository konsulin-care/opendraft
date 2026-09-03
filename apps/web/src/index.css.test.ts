// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./index.css', import.meta.url)), 'utf8');

const COMPONENT_CLASSES = [
  'manuscript-page',
  'manuscript-editor',
  'block-rail',
  'block-rail-drafts',
  'rail-row',
  'rail-title',
  'draft-badge',
  'dimmed',
  'sidebar',
  'workspace-content',
  'metadata-editor',
  'metadata-file',
  'references-editor',
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

  it('scopes editor content styles to the manuscript editor container', () => {
    expect(css).toMatch(/\.manuscript-editor\s*\{/);
    const editorBlock = css.slice(css.indexOf('.manuscript-editor'));
    expect(editorBlock).toMatch(/ProseMirror p\s*\{/);
    expect(editorBlock).toMatch(/ProseMirror h1\s*\{/);
  });

  it('styles the editor placeholder', () => {
    expect(css).toMatch(/data-placeholder/);
  });
});