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
) {
  return render(
    <MilkdownProvider>
      <ManuscriptEditor workspace={workspace} defaultValue={defaultValue} onEditorReady={onReady} />
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