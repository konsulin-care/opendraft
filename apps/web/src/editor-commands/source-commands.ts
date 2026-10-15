import type { EditorView } from '@codemirror/view';
import { redo as cmRedo, undo as cmUndo } from '@codemirror/commands';
import { INACTIVE_STATE, type ActiveState, type EditorCommands } from './types';

/**
 * Build the CodeMirror implementation of {@link EditorCommands} for the
 * source editor. Source mode supports undo and redo only: every formatting
 * action is a no-op so toolbar and keyboard-bar buttons can stay mounted
 * (disabled) without mutating the markdown document.
 *
 * @param getView - Returns the mounted CodeMirror view, or undefined/null
 *   while the editor is not ready.
 * @returns A command set bound to the source editor.
 */
export function createSourceCommands(
  getView: () => EditorView | null | undefined,
): EditorCommands {
  const noop = () => {};
  return {
    canFormat: false,
    undo: () => {
      const view = getView();
      if (view) cmUndo(view);
    },
    redo: () => {
      const view = getView();
      if (view) cmRedo(view);
    },
    toggleBold: noop,
    toggleItalic: noop,
    toggleStrike: noop,
    toggleInlineCode: noop,
    toggleLink: noop,
    insertCitation: noop,
    inlineMath: noop,
    setHeading: noop,
    bulletList: noop,
    orderedList: noop,
    taskList: noop,
    blockquote: noop,
    codeBlock: noop,
    table: noop,
    hr: noop,
    image: noop,
    activeState: (): ActiveState => INACTIVE_STATE,
  };
}
