// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { MilkdownProvider } from '@milkdown/react';
import { EditorView } from '@codemirror/view';
import { AppHeader } from './components/AppHeader';
import { ManuscriptEditor, type EditorTestApi } from './components/ManuscriptEditor';
import { useEditorMode } from './hooks/useEditorMode';
import { getFileCapability } from './project/file-capability';
import { readPreferences, writePreferences } from './preferences';

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
      <ManuscriptEditor workspace={workspace} defaultValue={DOC} path="manuscript.md" onEditorReady={onReady} mode={mode} />
    </MilkdownProvider>,
  );
}

/** Switch the mounted editor to the given mode without remounting. */
function setMode(result: ReturnType<typeof render>, workspace: MemoryWorkspace, mode: 'wysiwyg' | 'source') {
  result.rerender(
    <MilkdownProvider>
      <ManuscriptEditor workspace={workspace} defaultValue={DOC} path="manuscript.md" mode={mode} />
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

/** Explanation shown by the mode switch when visual mode is unavailable. */
const GATE_TITLE = 'Visual mode is only available for .md and .qmd files';

/** Wait until the mode switch is disabled and carries the gate explanation. */
function expectGateDisabled(): HTMLButtonElement {
  const toggle = screen.getByRole('button', { name: GATE_TITLE }) as HTMLButtonElement;
  expect(toggle.disabled).toBe(true);
  expect(toggle.title).toBe(GATE_TITLE);
  return toggle;
}

/** Wait until the mode switch is re-enabled in visual mode for a rich file. */
async function expectVisualRestored(getApi: () => EditorTestApi | null) {
  await waitFor(() => expect(getApi()).not.toBeNull(), { timeout: 10000 });
  await waitFor(() => expect(getApi()!.getMarkdown()).toContain('Article'), { timeout: 10000 });
  const restored = screen.getByRole('button', { name: 'Switch to source' }) as HTMLButtonElement;
  expect(restored.disabled).toBe(false);
  expect(readPreferences().editorMode).toBe('wysiwyg');
}

/** Re-render the gate shell with a rich block file and wait for the editor. */
async function openMarkdown(
  rerender: (ui: React.ReactElement) => void,
  workspace: MemoryWorkspace,
  onReady: (api: EditorTestApi) => void,
) {
  rerender(
    <GatedShell
      workspace={workspace}
      path="manuscripts/p/blocks/01hx00000000.qmd"
      content="# Article\n\nBody text.\n"
      onReady={onReady}
    />,
  );
}

/** Header + editor shell mirroring the App wiring for the file-capability gate. */
function GatedShell({
  workspace,
  path,
  content,
  onReady,
}: {
  workspace: MemoryWorkspace;
  path: string;
  content: string;
  onReady?: (api: EditorTestApi) => void;
}) {
  const { mode } = useEditorMode();
  const visualAvailable = getFileCapability(path, content) === 'rich';
  return (
    <>
      <AppHeader
        fileName={path}
        projectName="Test Project"
        mode={mode}
        onSelectMode={() => {}}
        saveStatus="saved"
        formattingToolbar
        onToggleFormattingToolbar={() => {}}
        onCommit={() => {}}
        modeSwitchDisabled={!visualAvailable}
      />
      <MilkdownProvider>
        <ManuscriptEditor
          workspace={workspace}
          defaultValue={content}
          path={path}
          mode={mode}
          onEditorReady={onReady}
        />
      </MilkdownProvider>
    </>
  );
}

describe('File-type-gated editing mode', () => {
  let workspace: MemoryWorkspace;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
    localStorage.clear();
    writePreferences({ formattingToolbar: true, editorMode: 'wysiwyg' });
  });

  it('gates text files to source mode and restores visual mode for markdown', async () => {
    const bib = '@article{key,\n  title = {A Paper}\n}\n';
    let api: EditorTestApi | null = null;
    const onReady = (ready: EditorTestApi) => {
      api = ready;
    };
    const { rerender } = render(<GatedShell workspace={workspace} path="refs.bib" content={bib} onReady={onReady} />);

    // The preferred mode is wysiwyg, but a .bib file forces the source editor.
    await waitFor(() => {
      expect(document.querySelector('.cm-content')?.textContent).toContain('A Paper');
    }, { timeout: 10000 });

    // The mode switch is disabled and explains the gate.
    expectGateDisabled();

    // The persisted preference is not rewritten by the gate.
    expect(readPreferences().editorMode).toBe('wysiwyg');

    // Opening a markdown file restores the preferred visual mode and the switch.
    api = null;
    await openMarkdown(rerender, workspace, onReady);
    await expectVisualRestored(() => api);
  }, 30000);

  it('never passes binary file content to either editor', async () => {
    const binary = 'PNG\u0000BINARY\u0009MARKER';
    render(<GatedShell workspace={workspace} path="figures/fig.png" content={binary} />);

    await waitFor(() => {
      expect(document.querySelector('.cm-editor')).not.toBeNull();
    }, { timeout: 10000 });

    // Neither the source editor nor the visual editor received the bytes.
    expect(document.querySelector('.cm-content')?.textContent ?? '').not.toContain('MARKER');
    expect(document.body.textContent ?? '').not.toContain('BINARY');

    // Binary files are not rich: the toggle carries the gate explanation.
    expectGateDisabled();
  }, 30000);
});

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
