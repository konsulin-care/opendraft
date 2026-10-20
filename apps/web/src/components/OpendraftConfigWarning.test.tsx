// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { MilkdownProvider } from '@milkdown/react';
import { EditorView } from '@codemirror/view';
import { ManuscriptEditor } from './ManuscriptEditor';
import { scaffoldProject } from '../project/scaffold';
import { loadFile } from '../persistence';

// jsdom does not implement Range layout APIs that CodeMirror measures on focus.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

/** Path of the project config file under test. */
const CONFIG_PATH = 'opendraft.yml';

/** Config content that parses but is missing the required manuscripts key. */
const MISSING_MANUSCRIPTS = 'protocol:\n  version: "1.0"\n';

/** Config content that cannot be parsed as YAML. */
const UNPARSEABLE = 'manuscripts: [unclosed\n';

/**
 * Mount the editor on opendraft.yml content and wait until the source
 * editor and the warning alert are rendered, then return both.
 *
 * opendraft.yml is not a manuscript block file, so the editor opens in
 * source mode and no Crepe/Milkdown instance is created.
 *
 * @param workspace - Workspace to mount the editor against.
 * @param content - Initial opendraft.yml content.
 * @returns The rendered alert element and the CodeMirror source view.
 */
async function mountConfigAlert(
  workspace: MemoryWorkspace,
  content: string,
): Promise<{ alert: HTMLElement; view: EditorView }> {
  mountConfig(workspace, content);
  const alert = await screen.findByRole('alert', {}, { timeout: 10000 });
  const view = await sourceView();
  return { alert, view };
}

/** Mount the editor on opendraft.yml with the given content. */
function mountConfig(workspace: MemoryWorkspace, content: string) {
  return render(
    <MilkdownProvider>
      <ManuscriptEditor workspace={workspace} defaultValue={content} path={CONFIG_PATH} />
    </MilkdownProvider>,
  );
}

/** Wait for the source editor's CodeMirror view. */
async function sourceView(): Promise<EditorView> {
  let view: EditorView | null = null;
  await waitFor(() => {
    const cmContent = document.querySelector('.cm-content') as HTMLElement | null;
    view = cmContent ? EditorView.findFromDOM(cmContent) : null;
    expect(view).not.toBeNull();
  }, { timeout: 10000 });
  return view!;
}

/** Replace the whole source document, scheduling a debounced save. */
function typeInSource(view: EditorView, text: string) {
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }));
}

describe('OpendraftConfigWarning', () => {
  it('lists the missing manuscripts field in an alert', async () => {
    const { alert } = await mountConfigAlert(new MemoryWorkspace(), MISSING_MANUSCRIPTS);
    expect(alert.textContent).toContain('manuscripts');
  }, 20000);

  it('reports a parse error in an alert for unparseable YAML', async () => {
    const { alert } = await mountConfigAlert(new MemoryWorkspace(), UNPARSEABLE);
    expect(alert.textContent?.toLowerCase()).toContain('parse');
  }, 20000);

  it('renders no alert for valid scaffolded content', async () => {
    const workspace = new MemoryWorkspace();
    await scaffoldProject(workspace, { manuscriptId: 'p' });
    const valid = await loadFile(workspace, CONFIG_PATH);
    mountConfig(workspace, valid);
    // The config opens in source mode: no alert, no Milkdown root.
    await waitFor(() => expect(document.querySelector('.cm-editor')).not.toBeNull(), {
      timeout: 10000,
    });
    expect(document.querySelector('[data-milkdown-root]')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  }, 20000);

  it('styles the banner with amber tokens instead of hex literals', async () => {
    const { alert } = await mountConfigAlert(new MemoryWorkspace(), MISSING_MANUSCRIPTS);
    const css = alert.getAttribute('style') ?? '';
    expect(css).toContain('var(--color-amber-500)');
    expect(css).toContain('var(--color-amber-100)');
    expect(css).toContain('var(--color-amber-800)');
    expect(css).not.toContain('#f59e0b');
    expect(css).not.toContain('#fef3c7');
    expect(css).not.toContain('#92400e');
  }, 20000);

  it('saves edits to the workspace while the warning is shown', async () => {
    const workspace = new MemoryWorkspace();
    const { view } = await mountConfigAlert(workspace, MISSING_MANUSCRIPTS);
    typeInSource(view, MISSING_MANUSCRIPTS + '\nmanuscripts edited while invalid\n');
    await waitFor(
      async () => {
        expect(await workspace.readFile(CONFIG_PATH)).toContain('manuscripts edited while invalid');
      },
      { timeout: 5000 },
    );
  }, 20000);
});
