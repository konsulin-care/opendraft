import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { App } from './App';
import { projectRegistry } from './hooks/useProjects';
import { workspaceManager } from '@opendraft/workspace';
import { EditorView } from '@codemirror/view';

// @vitest-environment jsdom

/** Clear localStorage and remove every project record. */
async function resetProjects(): Promise<void> {
  localStorage.clear();
  for (const record of await projectRegistry.list()) {
    await projectRegistry.remove(record.id);
  }
}

beforeEach(resetProjects);
afterEach(resetProjects);

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

    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    await waitFor(() => expect(within(screen.getByTestId('project-drawer')).getByRole('treeitem', { name: 'untitled-project' }).getAttribute('aria-selected')).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));

    await projectRegistry.setLastPath(records[0].id, 'manuscripts/references.bib');
    unmount();
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });

    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    const drawer = screen.getByTestId('project-drawer');
    await waitFor(() => expect(within(drawer).getAllByRole('treeitem', { name: 'references.bib' }).some(isSelected)).toBe(true));
  });
});

async function expectDrawerTreeOpensFiles(): Promise<void> {
  render(<App />);
  await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });

  fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
  const drawer = screen.getByTestId('project-drawer');

  expect(within(drawer).getByRole('button', { name: 'Untitled project' })).toBeDefined();

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

  fireEvent.click(within(drawer).getByRole('treeitem', { name: 'article.qmd' }));
  await waitFor(() => expect(within(drawer).getByRole('treeitem', { name: 'article.qmd' }).getAttribute('aria-selected')).toBe('true'));
  await waitFor(async () => {
    expect(await projectRegistry.getLastPath(records[0].id)).toBe('manuscripts/untitled-project/article.qmd');
  });
  await screen.findByTestId('manuscript-editor');
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

    fireEvent.click(within(drawer).getByRole('treeitem', { name: 'article.qmd' }));
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined());

    fireEvent.click(within(drawer).getByRole('treeitem', { name: 'untitled-project' }));
    await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined());
    await waitFor(async () => {
      expect(await projectRegistry.getLastPath((await projectRegistry.list())[0].id)).toBe('manuscripts/untitled-project');
    });
  });
});

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
      expect(await projectRegistry.getLastPath(record.id)).toBe('manuscripts/untitled-project/article.qmd');
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
  it('shows the icon header with the manuscript title and repo subtitle', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    const logo = screen.getByRole('button', { name: 'OpenDraft' });
    expect(logo.getAttribute('title')).toBe('OpenDraft');
    expect(screen.queryByText('OpenDraft')).toBeNull();
    const header = screen.getByTestId('app-header');
    const title = within(header).getByTestId('manuscript-title') as HTMLInputElement;
    expect(title.value).toBe('untitled-project');
    expect(within(header).getByText('Only on this device')).toBeDefined();
    expect(within(header).queryByTestId('project-name')).toBeNull();
  });

  it('shows no mode switch in the header', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Visual mode is only available for manuscript block files' })).toBeNull();
  });

  /** The editor header owns the draft action and chip; the banner is gone. */
  it('renders the draft action and status chip in the header without a suggestion banner', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    const header = screen.getByTestId('app-header');
    await waitFor(() => expect(within(header).getByRole('button', { name: 'Publish to GitHub' })).toBeDefined());
    expect(within(header).getByRole('button', { name: 'Draft' })).toBeDefined();
    expect(screen.queryByTestId('suggestion-banner')).toBeNull();
  });

  it('renaming the manuscript title moves the files and updates the tree and config', async () => {
    await expectManuscriptRenameMovesFiles();
  });
});

describe('App mode and commit', () => {
  it('renders no Formatting toolbar button and no Commit button in the header', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    const header = screen.getByTestId('app-header');
    expect(within(header).queryByRole('button', { name: 'Formatting toolbar' })).toBeNull();
    expect(within(header).queryByRole('button', { name: 'Commit' })).toBeNull();
    expect(within(header).getByRole('button', { name: 'Account' })).toBeDefined();
  });

  it('leaves the formatting toolbar rendered after Ctrl/Cmd+\\', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });
    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    const drawer = screen.getByTestId('project-drawer');
    fireEvent.click(within(drawer).getAllByRole('treeitem', { name: 'article.qmd' })[0]);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });

    fireEvent.keyDown(window, { key: '\\', ctrlKey: true });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(screen.getByRole('toolbar')).not.toBeNull();
  });

  it('does not render the removed commit dialog', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    expect(screen.queryByText('Commit Changes')).toBeNull();
  });
});

describe('App save status', () => {
  it('shows Saving then Saved after an edit triggers an autosave', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });
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

async function expectFilesChangedReListsTree(): Promise<void> {
  render(<App />);
  await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });
  fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
  const drawer = screen.getByTestId('project-drawer');
  expect(within(drawer).queryByRole('treeitem', { name: '_methods.qmd' })).toBeNull();

  const [record] = await projectRegistry.list();
  const ws = await workspaceManager.get(record.id);
  try {
    await ws.writeFile('manuscripts/untitled-project/blocks/_methods.qmd', '## Methods');
  } finally {
    workspaceManager.release(record.id);
  }
  act(() => window.dispatchEvent(new CustomEvent('opendraft:files-changed')));

  await waitFor(() => expect(within(drawer).getByRole('treeitem', { name: '_methods.qmd' })).toBeDefined(), { timeout: 5000 });
}

describe('App file tree re-list', () => {
  it('shows blocks/_<short>.qmd immediately after creation', async () => {
    await expectFilesChangedReListsTree();
  });
});

describe('App folder routing', () => {
  it("shows the folder notice for a non-manuscript folder and routes to 'manuscripts'", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-view')).toBeDefined(), { timeout: 10000 });
    const [record] = await projectRegistry.list();
    const ws = await workspaceManager.get(record.id);
    try {
      await ws.writeFile('notes/todo.md', '- [ ] todo');
    } finally {
      workspaceManager.release(record.id);
    }
    act(() => { window.dispatchEvent(new CustomEvent('opendraft:files-changed')); });
    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    const drawer = screen.getByTestId('project-drawer');
    await waitFor(() => expect(within(drawer).getByRole('treeitem', { name: 'notes' })).toBeDefined());
    fireEvent.click(within(drawer).getByRole('treeitem', { name: 'notes' }));
    await waitFor(() => expect(screen.getByText("Folders can't be opened here")).toBeDefined());
    expect(screen.getByRole('button', { name: 'Go to manuscripts' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to manuscripts' }));
    await waitFor(async () => {
      expect(await projectRegistry.getLastPath(record.id)).toBe('manuscripts');
    });
  });
});
