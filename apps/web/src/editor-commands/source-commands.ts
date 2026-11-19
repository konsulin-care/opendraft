import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { redo as cmRedo, undo as cmUndo } from '@codemirror/commands';
import {
  LIST_TABLE_BODY_OFFSET,
  LIST_TABLE_TEMPLATE,
} from '../list-table/insert-list-table';
import { INACTIVE_STATE, type ActiveState, type EditorCommands } from './types';

/**
 * Build the line prefix that keeps an inserted block separated from the text
 * already in the document. A block inserted mid-line starts on a fresh line;
 * a block inserted after non-empty text gets one blank line before it.
 *
 * @param state - Current editor state.
 * @param pos - Insertion offset.
 * @returns The newline prefix to insert before the block.
 */
function blockPrefix(state: EditorState, pos: number): string {
  const line = state.doc.lineAt(pos);
  if (pos > line.from) {
    const beforeCursor = line.text.slice(0, pos - line.from);
    return beforeCursor.trim() === '' ? '\n' : '\n\n';
  }
  if (line.number > 1) {
    const previous = state.doc.line(line.number - 1).text;
    return previous.trim() === '' ? '' : '\n';
  }
  return '';
}

/**
 * Insert the Quarto list-table template at the main selection and put the
 * cursor on its blank body line.
 *
 * @param view - Mounted CodeMirror view.
 */
function insertListTable(view: EditorView): void {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const prefix = blockPrefix(state, pos);
  const suffix = pos < line.to ? '\n' : '';
  const insert = `${prefix}${LIST_TABLE_TEMPLATE}${suffix}`;
  view.dispatch({
    changes: { from: pos, insert },
    selection: { anchor: pos + prefix.length + LIST_TABLE_BODY_OFFSET },
  });
  view.focus();
}

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
    table: () => {
      const view = getView();
      if (view) insertListTable(view);
    },
    hr: noop,
    image: noop,
    activeState: (): ActiveState => INACTIVE_STATE,
  };
}
