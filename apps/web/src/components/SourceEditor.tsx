import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';

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

/**
 * Raw markdown editor backed by CodeMirror 6 with markdown syntax
 * highlighting and the oneDark theme. Used for the "source" mode
 * toggle in ManuscriptEditor.
 */
export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(
  function SourceEditor({ value, onChange, className }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);

    // Mount CodeMirror on first render.
    useEffect(() => {
      if (!containerRef.current) return;

      const state = EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          markdown(),
          oneDark,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
            }
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // Only mount once — value is the initial doc, onChange is stable.
    }, []);

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
