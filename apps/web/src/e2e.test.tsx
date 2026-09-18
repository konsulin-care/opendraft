import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { MilkdownProvider } from '@milkdown/react';
import { ManuscriptEditor, type EditorTestApi } from './components/ManuscriptEditor';
import { MANUSCRIPT_PATH } from './persistence';

// @vitest-environment jsdom

function mountEditor(
  workspace: MemoryWorkspace,
  defaultValue: string,
  onReady: (api: EditorTestApi) => void,
  mode: 'wysiwyg' | 'source' = 'wysiwyg',
) {
  return render(
    <MilkdownProvider>
      <ManuscriptEditor workspace={workspace} defaultValue={defaultValue} onEditorReady={onReady} mode={mode} />
    </MilkdownProvider>,
  );
}

async function waitForSave(workspace: MemoryWorkspace, contains: string) {
  await waitFor(
    async () => {
      expect(await workspace.readFile(MANUSCRIPT_PATH)).toContain(contains);
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
      <ManuscriptEditor workspace={workspace} defaultValue={defaultValue} mode={mode} />
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
    const raw = await workspace.readFile(MANUSCRIPT_PATH);
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
    mountEditor(workspace, '# Hello', (ready) => (api = ready), 'source');
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    const cmEditor = document.querySelector('.cm-editor');
    expect(cmEditor).not.toBeNull();
  }, 20000);

  it('round-trips content from wysiwyg to source and back', async () => {
    const result = mountEditor(workspace, '# Original', (ready) => (api = ready), 'wysiwyg');
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
    const result = mountEditor(workspace, '# Initial', (ready) => (api = ready), 'wysiwyg');
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
    const result = mountEditor(workspace, sourceContent, (ready) => (api = ready), 'source');
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
