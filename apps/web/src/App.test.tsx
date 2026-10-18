import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, screen, waitFor, fireEvent } from '@testing-library/react';
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
    await waitFor(() => expect(screen.getByTitle('article.qmd')).toBeDefined(), { timeout: 10000 });

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
    await waitFor(() => expect(screen.getByTitle('references.bib')).toBeDefined(), { timeout: 10000 });
  });

});

describe('App header', () => {
  it('shows the icon header with the OpenDraft button and file name', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    const logo = screen.getByRole('button', { name: 'OpenDraft' });
    expect(logo.getAttribute('title')).toBe('OpenDraft');
    expect(screen.queryByText('OpenDraft')).toBeNull();
    expect(screen.getByTitle('article.qmd').textContent).toBe('article.qmd');
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
