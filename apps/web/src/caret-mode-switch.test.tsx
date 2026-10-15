// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { MilkdownProvider } from '@milkdown/react';
import { EditorView } from '@codemirror/view';
import { ManuscriptEditor, type EditorTestApi } from './components/ManuscriptEditor';

// jsdom does not implement Range layout APIs that CodeMirror measures on focus.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

const DOC = '# Title\n\nFirst paragraph.\n\nLast paragraph here.\n';

/** Mount the editor in the given mode and capture its test API. */
function mount(workspace: MemoryWorkspace, mode: 'wysiwyg' | 'source', onReady: (api: EditorTestApi) => void) {
  return render(
    <MilkdownProvider>
      <ManuscriptEditor workspace={workspace} defaultValue={DOC} onEditorReady={onReady} mode={mode} />
    </MilkdownProvider>,
  );
}

/** Switch the mounted editor to the given mode without remounting. */
function setMode(result: ReturnType<typeof render>, workspace: MemoryWorkspace, mode: 'wysiwyg' | 'source') {
  result.rerender(
    <MilkdownProvider>
      <ManuscriptEditor workspace={workspace} defaultValue={DOC} mode={mode} />
    </MilkdownProvider>,
  );
}

/** Return the CodeMirror view of the source editor once it is mounted. */
async function sourceView(): Promise<EditorView> {
  let view: EditorView | null = null;
  await waitFor(() => {
    const content = document.querySelector('.cm-content') as HTMLElement | null;
    view = content ? EditorView.findFromDOM(content) : null;
    expect(view).not.toBeNull();
  }, { timeout: 5000 });
  return view!;
}

describe('caret placement across mode switches', () => {
  let workspace: MemoryWorkspace;
  let api: EditorTestApi | null;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
    api = null;
  });

  it('places the visual caret at document start on first load', async () => {
    mount(workspace, 'wysiwyg', (ready) => (api = ready));
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    // Position 1 is the start of the first textblock (the heading content).
    await waitFor(() => expect(api!.getCaret()).toBe(1), { timeout: 5000 });
  }, 20000);

  it('places the source caret at document start on first load', async () => {
    mount(workspace, 'source', (ready) => (api = ready));
    const view = await sourceView();
    expect(view.state.selection.main.head).toBe(0);
  }, 20000);

  it('keeps the visual caret when the editor re-renders with the same mode', async () => {
    const result = mount(workspace, 'wysiwyg', (ready) => (api = ready));
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    api!.setCaret(Number.MAX_SAFE_INTEGER);
    const visualCaret = api!.getCaret();
    setMode(result, workspace, 'wysiwyg');
    await new Promise((r) => setTimeout(r, 300));
    expect(api!.getCaret()).toBe(visualCaret);
  }, 20000);

  it('maps the visual caret at document end into the source editor and back', async () => {
    const result = mount(workspace, 'wysiwyg', (ready) => (api = ready));
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    api!.setCaret(Number.MAX_SAFE_INTEGER);
    const visualCaret = api!.getCaret();

    setMode(result, workspace, 'source');
    const view = await sourceView();
    const expectedOffset = DOC.trimEnd().length;
    expect(view.state.selection.main.head).toBe(expectedOffset);

    setMode(result, workspace, 'wysiwyg');
    await waitFor(() => expect(api!.getCaret()).toBe(visualCaret), { timeout: 5000 });
    expect(api!.getMarkdown()).toContain('Last paragraph here.');
  }, 20000);
});
