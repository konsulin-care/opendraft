import { useCallback, useState } from 'react';
import type { EditorMode } from '../preferences';
import { readPreferences, writePreferences } from '../preferences';

/** Value returned by {@link useEditorMode}. */
export interface EditorModeState {
  /** Current editing surface. */
  mode: EditorMode;
  /** Change the editing surface and persist it to localStorage. */
  setMode: (mode: EditorMode) => void;
}

/**
 * Hook that exposes the persisted editing surface (visual or source) and a
 * setter that persists changes to localStorage (`opendraft:prefs`).
 *
 * The initial mode is read synchronously from localStorage; missing or corrupt
 * storage falls back to the default (`wysiwyg`). On change only `editorMode`
 * is rewritten — the stored `formattingToolbar` preference is preserved.
 *
 * @returns The current mode and a setter function.
 */
export function useEditorMode(): EditorModeState {
  const [mode, setModeState] = useState<EditorMode>(
    () => readPreferences().editorMode,
  );

  const setMode = useCallback((next: EditorMode) => {
    setModeState(next);
    writePreferences({
      formattingToolbar: readPreferences().formattingToolbar,
      editorMode: next,
    });
  }, []);

  return { mode, setMode };
}
