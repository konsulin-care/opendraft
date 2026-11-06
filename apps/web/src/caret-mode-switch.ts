import { editorViewCtx } from '@milkdown/kit/core';
import type { Editor } from '@milkdown/kit/core';
import { getMarkdown, replaceAll } from '@milkdown/kit/utils';
import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

/** Registered block editors, most recently registered last. */
const blockEditors: Editor[] = [];

/** Editor whose surface most recently received DOM focus; validated on read. */
let focusedBlockEditor: Editor | null = null;

/**
 * Register a mounted block editor so toolbar commands can target it.
 *
 * @param editor - The Milkdown editor of a mounted block.
 * @returns Callback removing the editor from the registry (idempotent).
 */
export function registerBlockEditor(editor: Editor): () => void {
  if (!blockEditors.includes(editor)) blockEditors.push(editor);
  return () => unregisterBlockEditor(editor);
}

/**
 * Remove a block editor from the registry. The focus pointer survives a
 * remove/re-add churn of the same editor and is dropped only once no
 * block editors remain.
 *
 * @param editor - The editor to remove.
 */
function unregisterBlockEditor(editor: Editor): void {
  const index = blockEditors.indexOf(editor);
  if (index >= 0) blockEditors.splice(index, 1);
  if (blockEditors.length === 0) focusedBlockEditor = null;
}

/**
 * Record DOM focus on a block editor's surface as the active target.
 *
 * @param editor - The editor whose surface received focus.
 */
export function focusBlockEditor(editor: Editor): void {
  focusedBlockEditor = editor;
}

/**
 * The block editor toolbar commands target: the most recently focused
 * registered editor, falling back to the most recently registered one.
 * Exported for {@link useEditorCommands}, which binds the Milkdown command
 * set to it.
 *
 * @returns The active block editor, or undefined when none is registered.
 */
export function getActiveBlockEditor(): Editor | undefined {
  if (focusedBlockEditor && blockEditors.includes(focusedBlockEditor)) {
    return focusedBlockEditor;
  }
  return blockEditors[blockEditors.length - 1];
}

/** Imperative handle exposed for tests and external tools. */
export interface EditorTestApi {
  /** Insert text at the end of the document through the editor state. */
  insertText(text: string): void;
  /** Current markdown as seen by the editor. */
  getMarkdown(): string;
  /** Replace the entire editor content with new markdown. */
  setMarkdown(markdown: string): void;
  /** Current visual (ProseMirror) selection position. */
  getCaret(): number;
  /** Place the visual caret; values past the end clamp to the document end. */
  setCaret(pos: number): void;
}

/**
 * Build the imperative test/external API around a milkdown editor.
 *
 * The second parameter is accepted for callers that still pass a surface
 * switch callback; with the editor-mode system removed it is ignored.
 *
 * @param editor - The Milkdown editor instance to wrap.
 * @param _syncContent - Unused legacy mode-switch callback.
 * @returns The imperative API bound to the editor.
 */
export function createTestApi(
  editor: Editor,
  _syncContent?: (mode: 'wysiwyg' | 'source') => void,
): EditorTestApi {
  return {
    insertText: (text) => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const position = view.state.doc.content.size;
        view.dispatch(view.state.tr.insertText(text, position));
      });
    },
    getMarkdown: () => editor.action(getMarkdown()),
    setMarkdown: (markdown) => editor.action(replaceAll(markdown)),
    getCaret: () => editor.action((ctx) => ctx.get(editorViewCtx).state.selection.from),
    setCaret: (pos) => editor.action((ctx) => placeVisualCaret(ctx.get(editorViewCtx), pos)),
  };
}

/**
 * Place the ProseMirror selection and scroll it into view.
 *
 * @param view - ProseMirror view of the visual editor.
 * @param pos - Target position, clamped to the document; null places the caret at document start.
 */
function placeVisualCaret(view: EditorView, pos: number | null): void {
  const { doc } = view.state;
  const selection = pos === null
    ? Selection.atStart(doc)
    : TextSelection.near(doc.resolve(Math.max(0, Math.min(pos, doc.content.size))));
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
}
