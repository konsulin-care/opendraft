import { useMemo } from 'react';
import type { EditorView } from '@codemirror/view';
import { getActiveBlockEditor } from '../caret-mode-switch';
import { createMilkdownCommands } from '../editor-commands/milkdown-commands';
import { createSourceCommands } from '../editor-commands/source-commands';
import type { EditorCommands } from '../editor-commands/types';

/**
 * Pick the editor-agnostic command set for the current editing mode:
 * Milkdown commands bound to the active (most recently focused) block
 * editor in WYSIWYG mode, CodeMirror source commands (undo/redo only,
 * `canFormat` false) in source mode. With no block editor registered the
 * Milkdown commands are no-ops.
 *
 * @param mode - Current editing mode.
 * @param getView - Returns the source CodeMirror view, or null when unmounted.
 * @returns The command set bound to the active surface.
 */
export function useEditorCommands(
  mode: 'wysiwyg' | 'source',
  getView: () => EditorView | null,
): EditorCommands {
  const milkdown = useMemo(() => createMilkdownCommands(getActiveBlockEditor), []);
  return useMemo(
    () => (mode === 'source' ? createSourceCommands(getView) : milkdown),
    [mode, getView, milkdown],
  );
}
