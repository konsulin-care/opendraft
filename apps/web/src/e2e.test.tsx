import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { MilkdownProvider } from '@milkdown/react';
import { EditorView } from '@codemirror/view';
import { ManuscriptEditor, type EditorTestApi } from './components/ManuscriptEditor';

// @vitest-environment jsdom

/** Manuscript block path: the only file type that mounts the visual editor. */
const DOC_PATH = 'manuscripts/p/blocks/01hxyz00000000000000000000.qmd';

interface MountOptions {
  mode?: 'wysiwyg' | 'source';
  path?: string;
}

function mountEditor(
  workspace: MemoryWorkspace,
  defaultValue: string,
  onReady: (api: EditorTestApi) => void,
  options: MountOptions = {},
) {
  const { mode = 'wysiwyg', path = DOC_PATH } = options;
  return render(
    <MilkdownProvider>
      <ManuscriptEditor workspace={workspace} defaultValue={defaultValue} onEditorReady={onReady} mode={mode} path={path} />
    </MilkdownProvider>,
  );
}

async function waitForSave(workspace: MemoryWorkspace, contains: string, path: string = DOC_PATH) {
  await waitFor(
    async () => {
      expect(await workspace.readFile(path)).toContain(contains);
    },
    { timeout: 5000 },
  );
}

function rerenderMode(
  result: ReturnType<typeof render>,
  workspace: MemoryWorkspace,
  defaultValue: string,
  mode: 'wysiwyg' | 'source',
) {
  result.rerender(
    <MilkdownProvider>
      <ManuscriptEditor workspace={workspace} defaultValue={defaultValue} mode={mode} path={DOC_PATH} />
    </MilkdownProvider>,
  );
}

async function waitForSourceEditor() {
  await waitFor(() => {
    const cmEditor = document.querySelector('.cm-editor');
    expect(cmEditor).not.toBeNull();
  }, { timeout: 5000 });
}

async function waitForMarkdown(api: EditorTestApi, expected: string) {
  await waitFor(() => {
    expect(api!.getMarkdown()).toContain(expected);
  }, { timeout: 10000 });
}

describe('End-to-end manuscript editing flow', () => {
  let workspace: MemoryWorkspace;
  let api: EditorTestApi | null;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
    api = null;
  });

  it('autosaves edits to the single manuscript file', async () => {
    mountEditor(workspace, '# Introduction\n\nStart writing.', (ready) => (api = ready));
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    api!.insertText('A fresh sentence appeared.');
    await waitForSave(workspace, 'A fresh sentence appeared.');
  }, 20000);

  it('setMarkdown replaces editor content and is reflected by getMarkdown', async () => {
    mountEditor(workspace, '# Initial', (ready) => (api = ready));
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    api!.setMarkdown('# Replaced\n\nNew content.');
    expect(api!.getMarkdown()).toContain('# Replaced');
    expect(api!.getMarkdown()).toContain('New content.');
  }, 20000);

  it('restores persisted content on reload', async () => {
    const first = mountEditor(workspace, '# Introduction\n\nStart writing.', (ready) => (api = ready));
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    api!.insertText('Saved across sessions.');
    await waitForSave(workspace, 'Saved across sessions.');
    first.unmount();
    api = null;
    const raw = await workspace.readFile(DOC_PATH);
    expect(raw).toBeTruthy();
    mountEditor(workspace, raw!, (ready) => (api = ready));
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    expect(api!.getMarkdown()).toContain('Saved across sessions.');
  }, 20000);
});

describe('Source/visual mode switching', () => {
  let workspace: MemoryWorkspace;
  let api: EditorTestApi | null;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
    api = null;
  });

  it('shows SourceEditor in source mode', async () => {
    mountEditor(workspace, '# Hello', (ready) => (api = ready), { mode: 'source' });
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    const cmEditor = document.querySelector('.cm-editor');
    expect(cmEditor).not.toBeNull();
  }, 20000);

  it('round-trips content from wysiwyg to source and back', async () => {
    const result = mountEditor(workspace, '# Original', (ready) => (api = ready), { mode: 'wysiwyg' });
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    expect(api!.getMarkdown()).toContain('# Original');
    rerenderMode(result, workspace, '# Original', 'source');
    await waitForSourceEditor();
    rerenderMode(result, workspace, '# Original', 'wysiwyg');
    await waitForMarkdown(api!, '# Original');
  }, 20000);
});

describe('Mode switch content sync', () => {
  let workspace: MemoryWorkspace;
  let api: EditorTestApi | null;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
    api = null;
  });

  it('syncs WYSIWYG edits to source editor on mode switch', async () => {
    const result = mountEditor(workspace, '# Initial', (ready) => (api = ready), { mode: 'wysiwyg' });
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    api!.setMarkdown('# Initial\n\nTyped in visual mode.');
    await waitFor(() => {
      expect(api!.getMarkdown()).toContain('Typed in visual mode.');
    }, { timeout: 10000 });
    rerenderMode(result, workspace, '# Initial', 'source');
    await waitForSourceEditor();
    const cmContent = document.querySelector('.cm-content');
    expect(cmContent).not.toBeNull();
    expect(cmContent!.textContent).toContain('Typed in visual mode.');
  }, 20000);

  it('syncs source edits back to WYSIWYG on mode switch', async () => {
    const sourceContent = '# Initial\n\nTyped in source.';
    const result = mountEditor(workspace, sourceContent, (ready) => (api = ready), { mode: 'source' });
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    await waitForSourceEditor();
    const cmContent = document.querySelector('.cm-content');
    expect(cmContent).not.toBeNull();
    expect(cmContent!.textContent).toContain('Typed in source.');
    rerenderMode(result, workspace, sourceContent, 'wysiwyg');
    await waitForMarkdown(api!, 'Typed in source.');
    expect(api!.getMarkdown()).toContain('Typed in source.');
  }, 20000);
});

/** Mount the editor in source mode at `path` and return its render result and CodeMirror view. */
async function mountSourceAt(
  workspace: MemoryWorkspace,
  path: string,
): Promise<{ result: ReturnType<typeof render>; view: EditorView }> {
  let view: EditorView | null = null;
  const result = render(
    <MilkdownProvider>
      <ManuscriptEditor workspace={workspace} defaultValue="# A" mode="source" path={path} />
    </MilkdownProvider>,
  );
  await waitFor(() => {
    const content = document.querySelector('.cm-content') as HTMLElement | null;
    view = content ? EditorView.findFromDOM(content) : null;
    expect(view).not.toBeNull();
  }, { timeout: 5000 });
  return { result, view: view! };
}

/** Replace the whole source document, scheduling a debounced save synchronously. */
function typeInSource(view: EditorView, text: string) {
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }));
}

describe('Path-aware autosave', () => {
  let workspace: MemoryWorkspace;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
  });

  it('autosaves typed text to the path prop', async () => {
    const { view } = await mountSourceAt(workspace, 'a/x.qmd');
    typeInSource(view, '# A\n\nTyped at the path prop.');
    await waitForSave(workspace, 'Typed at the path prop.', 'a/x.qmd');
  }, 20000);

  it('flushes a pending edit to the old path when the path prop changes', async () => {
    const { result, view } = await mountSourceAt(workspace, 'a/x.qmd');
    typeInSource(view, '# A\n\nedited for x');

    // Re-render with the new path within the 800ms debounce window: the
    // pending edit must land on the OLD path, and the new one stays untouched.
    result.rerender(
      <MilkdownProvider>
        <ManuscriptEditor workspace={workspace} defaultValue="# A" mode="source" path="a/y.qmd" />
      </MilkdownProvider>,
    );

    await waitForSave(workspace, 'edited for x', 'a/x.qmd');
    // Let the original debounce window elapse: nothing may reach a/y.qmd.
    await new Promise((r) => setTimeout(r, 1000));
    expect(await workspace.readFile('a/y.qmd')).toBeNull();
  }, 20000);

  it('flushes a pending edit to the path prop on unmount', async () => {
    const { result, view } = await mountSourceAt(workspace, 'a/x.qmd');
    typeInSource(view, '# A\n\nedited right before unmount');
    // Unmount while the debounce is still pending: flush must save, not drop.
    result.unmount();
    await waitForSave(workspace, 'edited right before unmount', 'a/x.qmd');
  }, 20000);
});
