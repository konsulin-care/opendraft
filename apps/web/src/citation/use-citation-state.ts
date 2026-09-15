import { useCallback, useEffect, useState } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { editorViewCtx, type Editor } from '@milkdown/kit/core';
import { citationPluginKey } from './plugin';
import type { CitationState, CitationAction } from './types';

/**
 * Hook that subscribes to citation plugin state from ProseMirror.
 *
 * @param editorRef - Ref to the Milkdown editor instance.
 * @returns Citation state and dispatch function.
 */
export function useCitationState(editorRef: React.MutableRefObject<Editor | null>) {
  const [citationState, setCitationState] = useState<CitationState | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let view: EditorView | null = null;
    editor.action((ctx) => {
      view = ctx.get(editorViewCtx);
    });
    if (!view) return;

    const initialState = citationPluginKey.getState(view.state) as CitationState | null;
    if (initialState) setCitationState(initialState);

    const originalDispatch = view.dispatch.bind(view);
    const patchedDispatch = (tr: Parameters<typeof originalDispatch>[0]) => {
      originalDispatch(tr);
      const newState = citationPluginKey.getState(view!.state) as CitationState | null;
      if (newState) setCitationState(newState);
    };
    view.dispatch = patchedDispatch;

    return () => {
      if (view) view.dispatch = originalDispatch;
    };
  }, [editorRef]);

  const dispatch = useCallback(
    (action: CitationAction) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const tr = view.state.tr.setMeta(citationPluginKey, action);
        view.dispatch(tr);
      });
    },
    [editorRef],
  );

  return { citationState, dispatch };
}
