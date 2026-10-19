import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Annotation, EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, lineNumbers, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion, completionKeymap as autocompleteCompletionKeymap, closeBrackets } from '@codemirror/autocomplete';
import { searchKeymap as searchSearchKeymap } from '@codemirror/search';
import { history, defaultKeymap, historyKeymap, undo as cmUndo, redo as cmRedo } from '@codemirror/commands';
import { foldGutter, foldKeymap, indentOnInput, bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

/** Imperative handle for SourceEditor — cursor, scroll, history, and view access. */
export interface SourceEditorHandle {
  getCursor(): number;
  setCursor(pos: number): void;
  /** Replace the whole document and place the caret in one transaction. */
  setContent(markdown: string, cursor: number): void;
  getScrollTop(): number;
  setScrollTop(pos: number): void;
  undo(): void;
  redo(): void;
  getView(): EditorView | null;
}

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Additional class for the outer container (e.g. column layout). */
  className?: string;
  /**
   * Syntax language for the buffer: 'markdown' for rich files, 'plain' for
   * other text files. Changing it recreates the CodeMirror state.
   */
  language?: 'markdown' | 'plain';
}

/**
 * Scroll the source viewport so the line at offset is visible. Uses the line
 * block geometry only, avoiding CodeMirror's DOM measurement.
 *
 * @param view - CodeMirror view to scroll.
 * @param offset - Character offset to reveal.
 */
function revealOffset(view: EditorView, offset: number): void {
  const block = view.lineBlockAt(offset);
  const { scrollDOM } = view;
  const visibleBottom = scrollDOM.scrollTop + scrollDOM.clientHeight;
  if (block.top >= scrollDOM.scrollTop && block.bottom <= visibleBottom) return;
  scrollDOM.scrollTop = Math.max(0, block.top - scrollDOM.clientHeight / 3);
}

/** Create the imperative handle methods for cursor/scroll preservation. */
function makeImperativeHandle(
  viewRef: React.MutableRefObject<EditorView | null>,
): SourceEditorHandle {
  return {
    getCursor() {
      const view = viewRef.current;
      return view ? view.state.selection.main.head : 0;
    },
    setCursor(pos: number) {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        selection: { anchor: Math.min(pos, view.state.doc.length) },
      });
    },
    setContent(markdown: string, cursor: number) {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      const target = Math.min(cursor, markdown.length);
      view.dispatch({
        ...(current === markdown ? {} : { changes: { from: 0, to: current.length, insert: markdown } }),
        selection: { anchor: target },
      });
      revealOffset(view, target);
    },
    getScrollTop() {
      const view = viewRef.current;
      if (!view) return 0;
      return view.scrollDOM.scrollTop;
    },
    setScrollTop(pos: number) {
      const view = viewRef.current;
      if (!view) return;
      view.scrollDOM.scrollTop = pos;
    },
    undo() {
      const view = viewRef.current;
      if (view) cmUndo(view);
    },
    redo() {
      const view = viewRef.current;
      if (view) cmRedo(view);
    },
    getView() {
      return viewRef.current;
    },
  };
}

/** Annotation tagging transactions that sync an external value into the view. */
const externalSync = Annotation.define<boolean>();

/** Sync external prop changes into a CodeMirror view, skipping user edits. */
function useExternalValueSync(
  viewRef: React.MutableRefObject<EditorView | null>,
  isInternalChangeRef: React.MutableRefObject<boolean>,
  value: string,
) {
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc) {
      // Tag the transaction so the update listener treats it as a programmatic
      // sync: loading a new file's content must not fire onChange (which would
      // schedule an autosave of the loaded content to the current path).
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
        annotations: externalSync.of(true),
      });
    }
  }, [value]);
}

/**
 * Light theme for the source editor: white background, dark foreground and a
 * neutral gray active line, matching the .manuscript-editor reading surface.
 * Colors reference the @theme tokens in index.css so hex values live in one
 * place; the rendered values are unchanged because the tokens hold the
 * original hex values.
 */
const lightEditorTheme = EditorView.theme({
  '&': { color: 'var(--color-black)', backgroundColor: 'var(--color-white)' },
  '.cm-content': { caretColor: 'var(--color-black)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-black)' },
  '.cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--color-selection)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--color-selection)' },
  '.cm-activeLine': { backgroundColor: 'var(--color-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-active-line)' },
  '.cm-gutters': {
    color: 'var(--color-muted)',
    backgroundColor: 'var(--color-gutter-bg)',
    borderRight: '1px solid var(--color-secondary)',
  },
}, { dark: false });

/** Create a CodeMirror EditorState with optional markdown support and change tracking. */
function createState(
  value: string,
  language: 'markdown' | 'plain',
  isInternalChangeRef: React.MutableRefObject<boolean>,
  onChange: (value: string) => void,
) {
  return EditorState.create({
    doc: value,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...autocompleteCompletionKeymap,
        ...searchSearchKeymap,
      ]),
      ...(language === 'markdown' ? [markdown()] : []),
      // Wrap long lines within the viewport instead of scrolling horizontally.
      EditorView.lineWrapping,
      lightEditorTheme,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        // Programmatic external-value syncs are not user edits: never report
        // them as changes or they would autosave loaded content to the path.
        if (update.transactions.some((tr) => tr.annotation(externalSync))) return;
        isInternalChangeRef.current = true;
        onChange(update.state.doc.toString());
      }),
    ],
  });
}

/**
 * Raw markdown editor backed by CodeMirror 6 with a light theme matching
 * the visual surface. Markdown syntax highlighting is used for rich files;
 * other text files get a plain buffer. Used for the "source" mode
 * toggle in ManuscriptEditor.
 */
export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(
  function SourceEditor({ value, onChange, className, language = 'markdown' }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const isInternalChangeRef = useRef(false);

    // Mount CodeMirror on first render; recreate when the language changes.
    useEffect(() => {
      if (!containerRef.current) return;
      const view = new EditorView({
        state: createState(value, language, isInternalChangeRef, onChange),
        parent: containerRef.current,
      });
      viewRef.current = view;
      return () => { view.destroy(); viewRef.current = null; };
    }, [language]);

    // Sync external value changes into CodeMirror.
    useExternalValueSync(viewRef, isInternalChangeRef, value);

    // Expose imperative methods for cursor/scroll preservation.
    useImperativeHandle(ref, () => makeImperativeHandle(viewRef));

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ height: '100%', overflow: 'auto' }}
      />
    );
  },
);
