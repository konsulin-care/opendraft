import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from './App';
import { useEditorMode } from './hooks/useEditorMode';
import {
  PREFERENCES_STORAGE_KEY,
  readPreferences,
  writePreferences,
} from './preferences';

// @vitest-environment jsdom

// jsdom localStorage is shared across tests in this file; clear it so a
// persisted editor mode (or toolbar preference) does not leak between tests.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('App', () => {
  it('boots into the single manuscript editor', async () => {
    render(<App />);
    await waitFor(
      () => expect(screen.getByTestId('manuscript-editor')).toBeDefined(),
      { timeout: 10000 },
    );
  });

});

describe('App header', () => {
  it('shows the icon header with the OpenDraft button and file name', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined());
    const logo = screen.getByRole('button', { name: 'OpenDraft' });
    expect(logo.getAttribute('title')).toBe('OpenDraft');
    expect(screen.queryByText('OpenDraft')).toBeNull();
    expect(screen.getByTitle('manuscript.md').textContent).toBe('manuscript.md');
  });

  it('shows a single mode toggle naming the target mode', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });
    const toggle = screen.getByRole('button', { name: 'Switch to source' });
    expect(toggle.getAttribute('title')).toBe('Switch to source');
    expect(toggle.getAttribute('aria-pressed')).toBeNull();
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
