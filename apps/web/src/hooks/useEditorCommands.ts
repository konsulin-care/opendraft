import { useMemo } from 'react';
import type { EditorView } from '@codemirror/view';
import { useMilkdownCommands } from '../editor-commands/milkdown-commands';
import { createSourceCommands } from '../editor-commands/source-commands';
import type { EditorCommands } from '../editor-commands/types';

/**
 * Pick the editor-agnostic command set for the current editing mode:
 * Milkdown commands in WYSIWYG mode, CodeMirror source commands
 * (undo/redo only, `canFormat` false) in source mode.
 *
 * @param mode - Current editing mode.
 * @param getView - Returns the source CodeMirror view, or null when unmounted.
 * @returns The command set bound to the active surface.
 */
export function useEditorCommands(
  mode: 'wysiwyg' | 'source',
  getView: () => EditorView | null,
): EditorCommands {
  const milkdown = useMilkdownCommands();
  return useMemo(
    () => (mode === 'source' ? createSourceCommands(getView) : milkdown),
    [mode, getView, milkdown],
  );
}
