import { useCallback, useEffect, useRef, useState } from 'react';
import { editorViewCtx, type Editor } from '@milkdown/kit/core';
import { citationPluginKey } from './plugin';
import type { CitationState, CitationAction } from './types';

/**
 * Hook that subscribes to citation plugin state from ProseMirror.
 *
 * Uses a stable ref callback that the plugin calls in its apply() method,
 * eliminating the dispatch-patching race condition.
 *
 * @param editorRef - Ref to the Milkdown editor instance.
 * @returns Citation state, dispatch function, and onStateChangeRef for plugin wiring.
 */
export function useCitationState(editorRef: React.MutableRefObject<Editor | null>) {
  const [citationState, setCitationState] = useState<CitationState | null>(null);

  // Stable ref so plugin can call it at creation time
  const onStateChangeRef = useRef((state: CitationState) => {
    setCitationState(state);
  });
  onStateChangeRef.current = (state) => setCitationState(state);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let view: { state: { getMeta: (key: typeof citationPluginKey) => CitationAction | undefined } } | null = null;
    editor.action((ctx) => {
      view = ctx.get(editorViewCtx);
    });
    if (!view) return;

    // Sync initial state
    const initialState = citationPluginKey.getState(view.state) as CitationState | null;
    if (initialState) setCitationState(initialState);
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

  return { citationState, dispatch, onStateChangeRef };
}