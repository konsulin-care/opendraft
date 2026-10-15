import { useEffect, useRef } from 'react';
import type { Editor } from '@milkdown/kit/core';
import { editorViewCtx, parserCtx, serializerCtx } from '@milkdown/kit/core';
import { replaceAll } from '@milkdown/kit/utils';
import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { visualSelectionToSourceOffset, sourceOffsetToVisualPosition } from './caret-sync';
import type { SourceEditorHandle } from './components/SourceEditor';

/** Editing mode shared by the visual and source surfaces. */
export type EditorMode = 'wysiwyg' | 'source';

/** Mutable ref shape used by the mode switcher. */
interface Ref<T> {
  current: T;
}

/**
 * Place the ProseMirror selection and scroll it into view.
 *
 * @param view - ProseMirror view of the visual editor.
 * @param pos - Target position, clamped to the document; null places the caret at document start.
 */
export function placeVisualCaret(view: EditorView, pos: number | null): void {
  const { doc } = view.state;
  const selection = pos === null
    ? Selection.atStart(doc)
    : TextSelection.near(doc.resolve(Math.max(0, Math.min(pos, doc.content.size))));
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
}

/**
 * Place the visual caret at document start once the editor is ready. Later
 * re-renders and re-wiring do not move it again.
 *
 * @param loading - Whether the editor is still loading.
 * @param getEditor - Returns the Milkdown editor, or nullish before it exists.
 */
export function useInitialCaret(loading: boolean, getEditor: () => Editor | null | undefined): void {
  const placedRef = useRef(false);
  useEffect(() => {
    if (placedRef.current) return;
    const editor = getEditor();
    if (!editor) return;
    placedRef.current = true;
    editor.action((ctx) => placeVisualCaret(ctx.get(editorViewCtx), null));
  }, [loading, getEditor]);
}

/**
 * Visual to source: serialize the document and move the source caret to the
 * markdown offset of the visual caret.
 *
 * @returns The serialized markdown that was loaded into the source editor.
 */
function enterSourceMode(editor: Editor, source: SourceEditorHandle | null): string {
  const { markdown, offset } = editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const serialize = ctx.get(serializerCtx);
    return {
      markdown: serialize(view.state.doc),
      offset: visualSelectionToSourceOffset({
        doc: view.state.doc,
        pos: view.state.selection.from,
        serialize,
      }),
    };
  });
  source?.setContent(markdown, offset);
  return markdown;
}

/**
 * Source to visual: replace the document with the source markdown and move
 * the visual caret to the position mapped from the source caret.
 */
function enterVisualMode(editor: Editor, source: SourceEditorHandle | null): void {
  const view = source?.getView();
  if (!view) return;
  const markdown = view.state.doc.toString();
  const offset = view.state.selection.main.head;
  const mapped = editor.action((ctx) =>
    sourceOffsetToVisualPosition({
      markdown,
      offset,
      parse: (text) => ctx.get(parserCtx)(text),
    }),
  );
  editor.action(replaceAll(markdown));
  editor.action((ctx) =>
    placeVisualCaret(ctx.get(editorViewCtx), mapped.found ? mapped.pos : null),
  );
}

/**
 * Build the callback that synchronizes content and caret when the mode changes.
 * Reads refs at call time, so the callback can be created once and reused.
 *
 * @param editorRef - Visual (Milkdown) editor ref.
 * @param sourceRef - Source (CodeMirror) editor handle ref.
 * @param prevModeRef - Last applied mode; updated on every call.
 * @param setSourceMarkdown - State setter for the source markdown.
 * @returns Callback invoked with the new mode.
 */
export function createModeSwitcher(
  editorRef: Ref<Editor | null>,
  sourceRef: Ref<SourceEditorHandle | null>,
  prevModeRef: Ref<EditorMode>,
  setSourceMarkdown: (md: string) => void,
): (mode: EditorMode) => void {
  return (newMode) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (newMode === 'source' && prevModeRef.current === 'wysiwyg') {
      setSourceMarkdown(enterSourceMode(editor, sourceRef.current));
    } else if (newMode === 'wysiwyg' && prevModeRef.current === 'source') {
      enterVisualMode(editor, sourceRef.current);
    }
    prevModeRef.current = newMode;
  };
}
