import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { App } from './App';
import { projectRegistry } from './hooks/useProjects';
import { workspaceManager } from '@opendraft/workspace';
import { useEditorMode } from './hooks/useEditorMode';
import {
  PREFERENCES_STORAGE_KEY,
  readPreferences,
  writePreferences,
} from './preferences';

// @vitest-environment jsdom

// Test classification for the editor-chrome rework (T1-T5):
//   superseded -> App.test.tsx, AppHeader.test.tsx, FormattingToolbar.test.tsx,
//                 SourceEditor.test.tsx (rewritten for the single mode toggle)
//   preserved  -> e2e.test.tsx, useToolbarPreference.test.tsx, KeyboardBar.test.tsx,
//                 source-commands.test.ts, manuscript-editor.test.ts,
//                 index.css.*.test.ts, index.html.test.ts, and packages/ tests
//                 (basename matches only).
// No test queries the removed Visual/Source segment buttons, and no test
// queries aria-pressed on the mode toggle.

// jsdom localStorage is shared across tests in this file; clear it so a
// persisted editor mode (or toolbar preference) does not leak between tests.
// The project registry is also reset so each test boots the app against an
// empty IndexedDB and triggers the auto-created starter project.
//
// The default file is now the scaffolded starter block
// (manuscripts/<id>/blocks/<lowercase-ulid>.qmd), not article.qmd.
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

describe('App', () => {
  it('boots into the single manuscript editor', async () => {
    render(<App />);
    await waitFor(
      () => expect(screen.getByTestId('manuscript-editor')).toBeDefined(),
      { timeout: 10000 },
    );
  });

  it('boots into an auto-created scaffolded project and reopens the last file', async () => {
    const { unmount } = render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });

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

    // Opening another file is remembered; a remount reopens it.
    await projectRegistry.setLastPath(records[0].id, 'manuscripts/untitled-project/references.bib');
    unmount();
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });

    // The remount reopens the last file: its treeitem is selected.
    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    const drawer = screen.getByTestId('project-drawer');
    await waitFor(() => {
      expect(
        within(drawer).getByRole('treeitem', { name: 'references.bib' }).getAttribute('aria-selected'),
      ).toBe('true');
    });
  });

});

describe('App project drawer', () => {
  it('renders the project selector and a file tree whose files open on click', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });

    // Open the drawer via the book icon.
    fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
    const drawer = screen.getByTestId('project-drawer');

    // Pinned header: the project selector.
    expect(within(drawer).getByRole('button', { name: 'Untitled project' })).toBeDefined();

    // Body: a treeitem for every workspace file, ULID block names as-is.
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
      expect(within(drawer).getByRole('treeitem', { name })).toBeDefined();
    }
    const blockName = paths
      .map((p) => p.split('/').pop() as string)
      .find((n) => /^[a-z0-9]{26}\.qmd$/.test(n));
    expect(blockName).toBeDefined();
    expect(
      within(drawer).getByRole('treeitem', { name: blockName as string }),
    ).toBeDefined();

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
  });
});

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

  it('renaming the manuscript title moves the files and updates the tree and config', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });
    const [record] = await projectRegistry.list();
    const ws = await workspaceManager.get(record.id);
    try {
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
      fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
      const drawer = screen.getByTestId('project-drawer');
      await waitFor(() => expect(within(drawer).getByRole('treeitem', { name: 'my-thesis' })).toBeDefined());
    } finally {
      workspaceManager.release(record.id);
    }
  });

  it('shows a single mode toggle naming the target mode', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });
    const toggle = screen.getByRole('button', { name: 'Switch to source' });
    expect(toggle.getAttribute('title')).toBe('Switch to source');
    expect(toggle.querySelector('.lucide-file-text')).not.toBeNull();
    expect(toggle.querySelector('.lucide-file-code')).toBeNull();
  });

});

describe('App mode and commit', () => {
  it('switches to source mode and back via the mode toggle', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });

    fireEvent.click(screen.getByRole('button', { name: 'Switch to source' }));
    expect(readPreferences().editorMode).toBe('source');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Switch to visual' })).toBeDefined());
    const sourceToggle = screen.getByRole('button', { name: 'Switch to visual' });
    expect(sourceToggle.querySelector('.lucide-file-code')).not.toBeNull();

    fireEvent.click(sourceToggle);
    expect(readPreferences().editorMode).toBe('wysiwyg');
    await waitFor(() => {
      const visualToggle = screen.getByRole('button', { name: 'Switch to source' });
      expect(visualToggle.querySelector('.lucide-file-text')).not.toBeNull();
    });
  });

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

describe('App persisted editor mode', () => {
  it('restores a persisted source mode on a fresh mount', async () => {
    writePreferences({ formattingToolbar: true, editorMode: 'source' });
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });
    const toggle = screen.getByRole('button', { name: 'Switch to visual' });
    expect(toggle.querySelector('.lucide-file-code')).not.toBeNull();
  });

  it('persists a mode switch to opendraft:prefs', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });

    fireEvent.click(screen.getByRole('button', { name: 'Switch to source' }));
    expect(readPreferences().editorMode).toBe('source');
    expect(
      JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) as string),
    ).toMatchObject({ v: 2, editorMode: 'source' });
  });
});

describe('useEditorMode persistence', () => {
  it('setMode("source") writes editorMode "source" to opendraft:prefs', () => {
    const { result } = renderHook(() => useEditorMode());
    expect(result.current.mode).toBe('wysiwyg');

    act(() => {
      result.current.setMode('source');
    });
    expect(result.current.mode).toBe('source');
    expect(readPreferences().editorMode).toBe('source');
    expect(
      JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) as string),
    ).toMatchObject({ v: 2, editorMode: 'source' });
  });

  it('a fresh hook mount returns the persisted mode', () => {
    const first = renderHook(() => useEditorMode());
    act(() => {
      first.result.current.setMode('source');
    });
    first.unmount();

    const second = renderHook(() => useEditorMode());
    expect(second.result.current.mode).toBe('source');
  });

  it('defaults to wysiwyg when nothing is stored', () => {
    const { result } = renderHook(() => useEditorMode());
    expect(result.current.mode).toBe('wysiwyg');
  });
});

describe('App save status', () => {
  it('shows Saving then Saved after an edit triggers an autosave', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });
    const paragraph = await waitFor(() => {
      const el = document.querySelector('.ProseMirror p');
      if (!el) throw new Error('editor not ready');
      return el;
    });
    paragraph.appendChild(document.createTextNode('Edited manuscript text'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saving'), { timeout: 3000 });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'), { timeout: 5000 });
  });
});
