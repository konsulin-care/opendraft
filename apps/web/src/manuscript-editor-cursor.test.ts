import { createElement } from 'react';
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ManuscriptEditor } from './components/ManuscriptEditor';

// @vitest-environment jsdom

const DOC = '# Introduction\n\nFirst paragraph of the manuscript.\n\nSecond paragraph.';
/** Manuscript block path: opens in the source-only editor. */
const DOC_PATH = 'manuscripts/p/blocks/01hxyz000000000000000000000000.qmd';
/** Source text of the crepe block-editor config, for the source-scan assertion. */
const crepeConfigSource = readFileSync(
  resolve(__dirname, 'components/crepe-config.ts'),
  'utf8',
);

describe('manuscript editor caret', () => {
  it('keeps the virtual caret feature disabled for block bodies', () => {
    expect(crepeConfigSource).toMatch(
      /\[Crepe\.Feature\.Cursor\]:\s*\{\s*virtual:\s*false\s*\}/,
    );
  });

  it('renders no ProseMirror surface or virtual caret element', async () => {
    render(
      createElement(ManuscriptEditor, {
        workspace: new MemoryWorkspace(),
        defaultValue: DOC,
        path: DOC_PATH,
      }),
    );
    await waitFor(
      () => expect(document.querySelector('.source-editor .cm-editor')).not.toBeNull(),
      { timeout: 10000 },
    );
    expect(document.querySelector('.ProseMirror')).toBeNull();
    expect(document.querySelector('.prosemirror-virtual-cursor')).toBeNull();
    expect(document.querySelector('[data-milkdown-root]')).toBeNull();
  }, 20000);

  it('mounts no ProseMirror or virtual caret for an empty manuscript and keeps the heading first', async () => {
    // Empty manuscript: the canonical heading with an empty body.
    render(
      createElement(ManuscriptEditor, {
        workspace: new MemoryWorkspace(),
        defaultValue: '# Introduction\n',
        path: DOC_PATH,
      }),
    );
    await waitFor(
      () => expect(document.querySelector('.source-editor .cm-editor')).not.toBeNull(),
      { timeout: 10000 },
    );
    expect(document.querySelector('.ProseMirror')).toBeNull();
    expect(document.querySelector('.prosemirror-virtual-cursor')).toBeNull();
    expect(document.querySelector('[data-milkdown-root]')).toBeNull();
    // The heading stays first in the rendered source: nothing is prepended.
    const content = document.querySelector('.source-editor .cm-content');
    expect(content).not.toBeNull();
    expect((content!.textContent ?? '').trimStart().startsWith('# Introduction')).toBe(true);
  }, 20000);
});
