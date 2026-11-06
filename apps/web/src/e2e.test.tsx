import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { EditorView } from '@codemirror/view';
import { ManuscriptEditor } from './components/ManuscriptEditor';

// @vitest-environment jsdom

/** Manuscript block path: every workspace file opens in the source-only editor. */
const DOC_PATH = 'manuscripts/p/blocks/01hxyz00000000000000000000.qmd';

/**
 * Wait until the workspace holds text containing the expected fragment.
 *
 * @param workspace - Workspace under test.
 * @param contains - Fragment the saved text must contain.
 * @param path - Repo-relative path expected to hold the text.
 */
async function waitForSave(
  workspace: MemoryWorkspace,
  contains: string,
  path: string = DOC_PATH,
): Promise<void> {
  await waitFor(
    async () => {
      expect(await workspace.readFile(path)).toContain(contains);
    },
    { timeout: 5000 },
  );
}

/** Wait until the source editor's CodeMirror surface exists. */
async function waitForSourceEditor(): Promise<void> {
  await waitFor(
    () => {
      expect(document.querySelector('.cm-editor')).not.toBeNull();
    },
    { timeout: 5000 },
  );
}

/**
 * Mount the source-only editor at a path and wait for its CodeMirror surface.
 *
 * @param workspace - Workspace the editor autosaves to.
 * @param defaultValue - Initial file content.
 * @param path - Repo-relative path of the opened file.
 * @returns The render result.
 */
async function mountEditor(
  workspace: MemoryWorkspace,
  defaultValue: string,
  path: string = DOC_PATH,
) {
  const result = render(
    <ManuscriptEditor workspace={workspace} defaultValue={defaultValue} path={path} />,
  );
  await waitForSourceEditor();
  return result;
}

/** Wait for the source editor's CodeMirror view. */
async function sourceView(): Promise<EditorView> {
  let view: EditorView | null = null;
  await waitFor(() => {
    const content = document.querySelector('.cm-content') as HTMLElement | null;
    view = content ? EditorView.findFromDOM(content) : null;
    expect(view).not.toBeNull();
  }, { timeout: 5000 });
  return view!;
}

/** Replace the whole source document, scheduling a debounced save synchronously. */
function typeInSource(view: EditorView, text: string): void {
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }));
}

describe('End-to-end manuscript editing flow', () => {
  let workspace: MemoryWorkspace;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
  });

  it('autosaves edits to the single manuscript file', async () => {
    await mountEditor(workspace, '# Introduction\n\nStart writing.');
    const view = await sourceView();
    typeInSource(view, '# Introduction\n\nStart writing. A fresh sentence appeared.');
    await waitForSave(workspace, 'A fresh sentence appeared.');
  }, 20000);

  it('reflects typed edits in the buffer and persists them', async () => {
    await mountEditor(workspace, '# Initial');
    const view = await sourceView();
    typeInSource(view, '# Replaced\n\nNew content.');
    expect(view.state.doc.toString()).toContain('# Replaced');
    await waitForSave(workspace, 'New content.');
  }, 20000);

  it('restores persisted content on reload', async () => {
    const first = await mountEditor(workspace, '# Introduction\n\nStart writing.');
    const view = await sourceView();
    typeInSource(view, '# Introduction\n\nSaved across sessions.');
    await waitForSave(workspace, 'Saved across sessions.');
    first.unmount();
    const raw = await workspace.readFile(DOC_PATH);
    expect(raw).toBeTruthy();
    await mountEditor(workspace, raw!);
    const reloaded = await sourceView();
    expect(reloaded.state.doc.toString()).toContain('Saved across sessions.');
  }, 20000);
});

describe('Path-aware autosave', () => {
  let workspace: MemoryWorkspace;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
  });

  it('autosaves typed text to the path prop', async () => {
    await mountEditor(workspace, '# A', 'a/x.qmd');
    const view = await sourceView();
    typeInSource(view, '# A\n\nTyped at the path prop.');
    await waitForSave(workspace, 'Typed at the path prop.', 'a/x.qmd');
  }, 20000);

  it('flushes a pending edit to the old path when the path prop changes', async () => {
    const result = await mountEditor(workspace, '# A', 'a/x.qmd');
    const view = await sourceView();
    typeInSource(view, '# A\n\nedited for x');

    // Re-render with the new path within the 800ms debounce window: the
    // pending edit must land on the OLD path, the new one stays untouched.
    result.rerender(
      <ManuscriptEditor workspace={workspace} defaultValue="# A" path="a/y.qmd" />,
    );

    await waitForSave(workspace, 'edited for x', 'a/x.qmd');
    // Let the original debounce window elapse: nothing may reach a/y.qmd.
    await new Promise((r) => setTimeout(r, 1000));
    expect(await workspace.readFile('a/y.qmd')).toBeNull();
  }, 20000);

  it('flushes a pending edit to the path prop on unmount', async () => {
    const result = await mountEditor(workspace, '# A', 'a/x.qmd');
    const view = await sourceView();
    typeInSource(view, '# A\n\nedited right before unmount');
    // Unmount while the debounce is still pending: flush must save, not drop.
    result.unmount();
    await waitForSave(workspace, 'edited right before unmount', 'a/x.qmd');
  }, 20000);
});
