import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { App } from './App';
import { projectRegistry } from './hooks/useProjects';
import { workspaceManager } from '@opendraft/workspace';
import { EditorView } from '@codemirror/view';

// @vitest-environment jsdom

// The default path of a freshly scaffolded project is the manuscript
// directory `manuscripts/<id>`, so the app boots into the manuscript view.
// Every file (article.qmd, block .qmd, .yml, ...) opens the source-only
// editor; there is no editor-mode system anymore.
beforeEach(async () => {
  localStorage.clear();
  for (const record of await projectRegistry.list()) {
    await projectRegistry.remove(record.id);
  }
});

afterEach(async () => {
  localStorage.clear();
  for (const record of await projectRegistry.list()) {
    await projectRegistry.remove(record.id);
  }
});

/** True when the element is the selected treeitem. */
function isSelected(el: HTMLElement): boolean {
  return el.getAttribute('aria-selected') === 'true';
}

describe('App', () => {
  it('boots into the manuscript view, not an article assembly', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });
    expect(screen.queryByTestId('article-assembly')).toBeNull();
  });

  it('boots into an auto-created scaffolded project and reopens the last path', async () => {
    const { unmount } = render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });

    // One registry record, and its od-ws-<id> database holds the scaffold.
    const records = await projectRegistry.list();
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Untitled project');
    const dbNames = (await indexedDB.databases()).map((db) => db.name);
    expect(dbNames).toContain('od-registry');
    expect(dbNames).toContain(`od-ws-${records[0].id}`);
    const ws = await workspaceManager.get(records[0].id);
    try {
      expect(await ws.readFile('opendraft.yml')).not.toBeNull();
      expect(await ws.readFile('manuscripts/untitled-project/article.qmd')).not.toBeNull();
    } finally {
      workspaceManager.release(records[0].id);
    }

    // Fresh boot opens the manuscript directory: its treeitem is selected.
    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    await waitFor(() => expect(
      within(screen.getByTestId('project-drawer')).getByRole('treeitem', { name: 'untitled-project' }).getAttribute('aria-selected'),
    ).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));

    // Opening another file is remembered; a remount reopens it.
    await projectRegistry.setLastPath(records[0].id, 'manuscripts/references.bib');
    unmount();
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });

    // The remount reopens the last file: its treeitem is selected.
    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    const drawer = screen.getByTestId('project-drawer');
    await waitFor(() => expect(
      within(drawer).getAllByRole('treeitem', { name: 'references.bib' })
        .some(isSelected),
    ).toBe(true));
  });
});

/** Drawer pins the project selector, lists every workspace file, and opens files on click. */
async function expectDrawerTreeOpensFiles(): Promise<void> {
  render(<App />);
  await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });

  // Open the drawer via the book icon.
  fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
  const drawer = screen.getByTestId('project-drawer');

  // Pinned header: the project selector.
  expect(within(drawer).getByRole('button', { name: 'Untitled project' })).toBeDefined();

  // Body: a treeitem for every workspace file, basenames as-is.
  const records = await projectRegistry.list();
  const ws = await workspaceManager.get(records[0].id);
  let paths: string[];
  try {
    paths = await ws.listAll();
  } finally {
    workspaceManager.release(records[0].id);
  }
  expect(paths.length).toBeGreaterThan(0);
  await waitFor(() => expect(within(drawer).getAllByRole('treeitem').length).toBeGreaterThan(1));
  for (const path of paths) {
    const name = path.split('/').pop() as string;
    expect(within(drawer).getAllByRole('treeitem', { name }).length).toBeGreaterThan(0);
  }

  // Clicking a file opens its path and selects its treeitem.
  fireEvent.click(within(drawer).getByRole('treeitem', { name: 'article.qmd' }));
  await waitFor(() => expect(
    within(drawer).getByRole('treeitem', { name: 'article.qmd' }).getAttribute('aria-selected'),
  ).toBe('true'));
  await waitFor(async () => {
    expect(await projectRegistry.getLastPath(records[0].id)).toBe(
      'manuscripts/untitled-project/article.qmd',
    );
  });
  expect(screen.getByTestId('manuscript-editor')).toBeDefined();
}

describe('App project drawer', () => {
  it('renders the project selector and a file tree whose files open on click', async () => {
    await expectDrawerTreeOpensFiles();
  });

  it('opens the manuscript view when the folder label is clicked', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });

    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    const drawer = screen.getByTestId('project-drawer');

    // Open a file first so the folder is not already the active path.
    fireEvent.click(within(drawer).getByRole('treeitem', { name: 'article.qmd' }));
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined());

    // Clicking the folder label opens the directory; the chevron only collapses.
    fireEvent.click(within(drawer).getByRole('treeitem', { name: 'untitled-project' }));
    await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined());
    await waitFor(async () => {
      expect(await projectRegistry.getLastPath((await projectRegistry.list())[0].id)).toBe(
        'manuscripts/untitled-project',
      );
    });
  });
});

/** Renaming the manuscript title moves the files and updates the tree and config. */
async function expectManuscriptRenameMovesFiles(): Promise<void> {
  render(<App />);
  await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });
  const [record] = await projectRegistry.list();
  const ws = await workspaceManager.get(record.id);
  try {
    // Open a file first: the rename remaps an open file path, not a dir.
    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    const drawer = screen.getByTestId('project-drawer');
    fireEvent.click(within(drawer).getByRole('treeitem', { name: 'article.qmd' }));
    await waitFor(async () => {
      expect(await projectRegistry.getLastPath(record.id)).toBe(
        'manuscripts/untitled-project/article.qmd',
      );
    });

    const title = within(screen.getByTestId('app-header')).getByTestId('manuscript-title');
    fireEvent.change(title, { target: { value: 'My Thesis' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    await waitFor(async () => {
      const listing = (await ws.listAll()).join('\n');
      expect(listing).toContain('manuscripts/my-thesis/');
      expect(listing).not.toContain('manuscripts/untitled-project/');
    }, { timeout: 5000 });
    expect(await projectRegistry.getLastPath(record.id)).toMatch(/^manuscripts\/my-thesis\//);
    expect(await ws.readFile('opendraft.yml')).toContain('manuscripts/my-thesis');
    await waitFor(() => expect(within(drawer).getByRole('treeitem', { name: 'my-thesis' })).toBeDefined());
  } finally {
    workspaceManager.release(record.id);
  }
}

describe('App header', () => {
  it('shows the icon header with the manuscript title over the project name', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    const logo = screen.getByRole('button', { name: 'OpenDraft' });
    expect(logo.getAttribute('title')).toBe('OpenDraft');
    expect(screen.queryByText('OpenDraft')).toBeNull();
    // The header shows the manuscript dir name (no display name stored
    // yet) over the active project name.
    const header = screen.getByTestId('app-header');
    const title = within(header).getByTestId('manuscript-title') as HTMLInputElement;
    expect(title.value).toBe('untitled-project');
    expect(within(header).getByDisplayValue('Untitled project')).toBeDefined();
  });

  it('shows no mode switch in the header', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Visual mode is only available for manuscript block files' })).toBeNull();
  });

  it('renaming the manuscript title moves the files and updates the tree and config', async () => {
    await expectManuscriptRenameMovesFiles();
  });
});

describe('App mode and commit', () => {
  it('toggles the formatting toolbar preference from the header', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    const toggle = screen.getByRole('button', { name: 'Formatting toolbar' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the commit dialog from the header Commit button', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));
    expect(screen.getByText('Commit Changes')).toBeDefined();
  });
});

describe('App save status', () => {
  it('shows Saving then Saved after an edit triggers an autosave', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });
    // The manuscript view has no CodeMirror surface: open a source file first.
    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    fireEvent.click(within(screen.getByTestId('project-drawer')).getAllByRole('treeitem', { name: 'references.bib' })[0]);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });
    const cm = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.cm-editor');
      if (!el) throw new Error('editor not ready');
      return el;
    }, { timeout: 5000 });
    const view = EditorView.findFromDOM(cm) as EditorView;
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'Edited manuscript text' } }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saving'), { timeout: 3000 });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'), { timeout: 5000 });
  });
});

/** After a block mutation, `opendraft:files-changed` re-lists the files into the tree. */
async function expectFilesChangedReListsTree(): Promise<void> {
  render(<App />);
  await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });
  fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
  const drawer = screen.getByTestId('project-drawer');
  expect(within(drawer).queryByRole('treeitem', { name: 'methods.qmd' })).toBeNull();

  // A block mutation landed a new block file on disk.
  const [record] = await projectRegistry.list();
  const ws = await workspaceManager.get(record.id);
  try {
    await ws.writeFile('manuscripts/untitled-project/blocks/methods.qmd', '## Methods');
  } finally {
    workspaceManager.release(record.id);
  }
  // T17 announces the mutation; the shell must re-list for the tree.
  act(() => {
    window.dispatchEvent(new CustomEvent('opendraft:files-changed'));
  });

  await waitFor(
    () => expect(within(drawer).getByRole('treeitem', { name: 'methods.qmd' })).toBeDefined(),
    { timeout: 5000 },
  );
}

describe('App file tree re-list', () => {
  it('shows blocks/<short>.qmd immediately after creation', async () => {
    await expectFilesChangedReListsTree();
  });
});
