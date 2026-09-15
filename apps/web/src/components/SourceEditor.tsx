import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, lineNumbers, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, completionKeymap as autocompleteCompletionKeymap, closeBrackets } from '@codemirror/autocomplete';
import { searchKeymap as searchSearchKeymap } from '@codemirror/search';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { foldGutter, foldKeymap, indentOnInput, bracketMatching } from '@codemirror/language';

/** Imperative handle for SourceEditor — cursor and scroll preservation. */
export interface SourceEditorHandle {
  getCursor(): number;
  setCursor(pos: number): void;
  getScrollTop(): number;
  setScrollTop(pos: number): void;
}

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
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
  };
}

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
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);
}

/** Create a CodeMirror EditorState with markdown support and change tracking. */
function createState(
  value: string,
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
      markdown(),
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          isInternalChangeRef.current = true;
          onChange(update.state.doc.toString());
        }
      }),
    ],
  });
}

/**
 * Raw markdown editor backed by CodeMirror 6 with markdown syntax
 * highlighting and the oneDark theme. Used for the "source" mode
 * toggle in ManuscriptEditor.
 */
export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(
  function SourceEditor({ value, onChange, className }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const isInternalChangeRef = useRef(false);

    // Mount CodeMirror on first render.
    useEffect(() => {
      if (!containerRef.current) return;
      const view = new EditorView({
        state: createState(value, isInternalChangeRef, onChange),
        parent: containerRef.current,
      });
      viewRef.current = view;
      return () => { view.destroy(); viewRef.current = null; };
    }, []);

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
