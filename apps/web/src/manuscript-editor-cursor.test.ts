import { createElement } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { MilkdownProvider } from '@milkdown/react';
import { ManuscriptEditor, type EditorTestApi } from './components/ManuscriptEditor';

// @vitest-environment jsdom

// jsdom has no layout: the virtual cursor calls Range geometry APIs.
if (typeof Range.prototype.getClientRects !== 'function') {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
}

const DOC = '# Introduction\n\nFirst paragraph of the manuscript.\n\nSecond paragraph.';

/**
 * Mount the manuscript editor with a document that starts with a heading.
 *
 * @param workspace - In-memory workspace used for autosave.
 * @param onReady - Receives the imperative test API once the editor is ready.
 * @returns The render result, used for cleanup.
 */
function mountEditor(workspace: MemoryWorkspace, onReady: (api: EditorTestApi) => void) {
  return render(
    createElement(
      MilkdownProvider,
      null,
      createElement(ManuscriptEditor, { workspace, defaultValue: DOC, path: "manuscript.md", onEditorReady: onReady }),
    ),
  );
}

describe('manuscript editor caret', () => {
  let workspace: MemoryWorkspace;
  let api: EditorTestApi | null;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
    api = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('does not insert the virtual caret element and keeps the heading first', async () => {
    mountEditor(workspace, (ready) => (api = ready));
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });

    const pm = document.querySelector('.ProseMirror') as HTMLElement;
    expect(pm).not.toBeNull();

    // Move the collapsed selection across the document, as a user would
    // when clicking through text. The virtual caret plugin re-inserts its
    // element on each collapsed selection.
    pm.focus();
    for (const pos of [1, 20, 40]) {
      api!.setCaret(pos);
      expect(pm.querySelector('.prosemirror-virtual-cursor')).toBeNull();
      const content = [...pm.children].filter((el) => !el.classList.contains('ProseMirror-widget'));
      expect(content[0]?.tagName).toBe('H1');
    }
  }, 20000);
});
