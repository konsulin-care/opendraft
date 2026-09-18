import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { SlashProvider } from "@milkdown/plugin-slash";
import type { WorkspaceAdapter } from "@opendraft/workspace";
import { parseBibTeX } from "@opendraft/references";
import { citationReducer, createInitialState } from "./state";
import type { CitationState, CitationAction } from "./types";
import { createRoot } from "react-dom/client";
import React from "react";
import { CitationDropdown } from "./dropdown";
import { appendReference } from "./file-write";
import { extractCitekey } from "./comparison";

export type CitationSelectHandler = (citekey: string) => void;

/** PluginKey for the citation plugin. */
export const citationPluginKey = new PluginKey("citation");

/**
 * Create the citation plugin for ProseMirror.
 *
 * Uses Milkdown's SlashProvider for @ trigger detection and dropdown positioning.
 *
 * @param workspace - Workspace adapter for reading references.bib.
 * @param onStateChange - Optional callback fired on every state transition.
 * @param onSelectCitekey - Optional callback when a citekey is selected.
 * @returns ProseMirror Plugin instance.
 */
export function createCitationPlugin(
  workspace: WorkspaceAdapter,
  onStateChange?: (state: CitationState) => void,
  onSelectCitekey?: CitationSelectHandler
): Plugin {
  return new Plugin({
    key: citationPluginKey,
    state: createState(onStateChange),
    props: createProps(),
    view: createView(workspace, onSelectCitekey),
  });
}

/** Create the plugin state spec. */
function createState(onStateChange?: (state: CitationState) => void) {
  return {
    init: () => createInitialState(),
    apply: (
      tr: import("@milkdown/kit/prose/state").Transaction,
      prev: CitationState
    ) => {
      const meta = tr.getMeta(citationPluginKey);
      const next = meta ? citationReducer(prev, meta) : prev;
      onStateChange?.(next);
      return next;
    },
  };
}

/** Create the plugin props spec. */
function createProps() {
  return {};
}

/** Create dispatch function for citation actions. */
function createDispatch(view: EditorView) {
  return (action: CitationAction) => {
    const tr = view.state.tr.setMeta(citationPluginKey, action);
    view.dispatch(tr);
  };
}

/** Check if the selection is at the end of the current node. */
function isSelectionAtEndOfNode(state: import("@milkdown/kit/prose/state").EditorState): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection)) return false;
  const { $head } = selection;
  const parent = $head.parent;
  const offset = $head.parentOffset;
  return offset === parent.content.size;
}

/** Check whether the citation dropdown should be shown. */
function shouldShowCitation(
  content: string | undefined,
  state: import("@milkdown/kit/prose/state").EditorState
): boolean {
  if (!content) return false;
  // Must start with @ (or [@ for bracketed mode)
  if (!content.startsWith("@") && !content.startsWith("[@")) return false;
  // Cursor must be at end of paragraph
  if (!isSelectionAtEndOfNode(state)) return false;
  return true;
}

/** Create SlashProvider configuration. */
function createSlashProviderConfig(
  dispatch: (action: CitationAction) => void,
  view: EditorView
) {
  const container = document.createElement("div");
  const root = createRoot(container);

  const provider = new SlashProvider({
    trigger: "@",
    content: container,
    debounce: 0,
    floatingUIOptions: {
      placement: "bottom-start",
    },
    shouldShow: (editorView): boolean =>
      shouldShowCitation(provider.getContent(editorView), editorView.state),
  });

  // Floating UI sets left/top but the wrapper needs position:absolute
  // for those values to take effect (same as .milkdown-slash-menu).
  provider.element.style.position = "absolute";

  provider.onShow = () => {
    const state = view.state;
    const { selection } = state;
    const from = selection.$from.pos - 1;
    const textBefore = state.doc.textBetween(Math.max(0, from - 1), from);
    const bracketed = textBefore === "[";

    dispatch({
      type: "OPEN_CITATION",
      trigger: { from, bracketed },
    });
  };

  provider.onHide = () => {
    dispatch({ type: "CLOSE_CITATION" });
  };

  return { provider, container, root };
}

/** Create dropdown update function. */
function createUpdateDropdown(
  root: ReturnType<typeof createRoot>,
  dispatch: (action: CitationAction) => void,
  onSelectCitekey?: CitationSelectHandler,
  onDoiResolved?: (bibtex: string) => void
) {
  return (state: CitationState) => {
    root.render(
      React.createElement(CitationDropdown, {
        state,
        dispatch,
        onSelectCitekey,
        onDoiResolved,
      })
    );
  };
}

/** Create the global keyboard handler for the citation dropdown. */
function createGlobalKeyHandler(
  view: EditorView,
  dispatch: (action: CitationAction) => void,
  onSelectCitekey?: CitationSelectHandler
) {
  return (event: KeyboardEvent) => {
    const state = citationPluginKey.getState(view.state) as CitationState;
    if (!state?.open) return;

    switch (event.key) {
      case "Enter":
        if (state.doiMode) return; // let React handle it
        event.preventDefault();
        if (state.items.length > 0 && state.activeIndex < state.items.length) {
          const citekey = state.items[state.activeIndex].citeKey;
          onSelectCitekey?.(citekey);
        }
        dispatch({ type: "CLOSE_CITATION" });
        break;
      case "ArrowDown":
        event.preventDefault();
        dispatch({ type: "INCREMENT_ACTIVE_INDEX" });
        break;
      case "ArrowUp":
        event.preventDefault();
        dispatch({ type: "DECREMENT_ACTIVE_INDEX" });
        break;
      case "Escape":
        event.preventDefault();
        dispatch({ type: "CLOSE_CITATION" });
        break;
    }
  };
}

/** Extract query text from editor content after the @ trigger. */
function extractQueryFromEditor(
  view: EditorView,
  triggerFrom: number
): string {
  const { selection } = view.state;
  const $from = selection.$from;
  // Get text from trigger position (after @) to cursor
  const text = view.state.doc.textBetween(
    Math.min(triggerFrom + 1, $from.pos),
    $from.pos,
    undefined,
    "\uFFFD"
  );
  return text;
}

/** Create the onDoiResolved handler for DOI resolution flow. */
function createDoiResolvedHandler(
  workspace: WorkspaceAdapter,
  view: EditorView,
  onSelectCitekey?: CitationSelectHandler,
) {
  return async (bibtex: string) => {
    await appendReference(workspace, bibtex);
    await loadReferences(workspace, view);
    const citekey = extractCitekey(bibtex);
    if (citekey) {
      onSelectCitekey?.(citekey);
    }
  };
}

/** Sync query from editor text when dropdown is open. */
function syncQueryFromEditor(editorView: EditorView, dispatch: (action: CitationAction) => void) {
  const citationState = citationPluginKey.getState(editorView.state) as CitationState | null;
  if (!citationState?.open || !citationState.trigger) return;
  const query = extractQueryFromEditor(editorView, citationState.trigger.from);
  if (query !== citationState.query) {
    dispatch({ type: "SET_QUERY", query });
  }
}

/** Create the plugin view spec. */
function createView(workspace: WorkspaceAdapter, onSelectCitekey?: CitationSelectHandler) {
  return (view: EditorView) => {
    loadReferences(workspace, view);
    const dispatch = createDispatch(view);
    const { provider, root } = createSlashProviderConfig(dispatch, view);

    let globalKeyHandler: ((event: KeyboardEvent) => void) | null = null;
    const installGlobalKeyHandler = () => {
      if (globalKeyHandler) return;
      globalKeyHandler = createGlobalKeyHandler(view, dispatch, onSelectCitekey);
      window.addEventListener("keydown", globalKeyHandler, { capture: true });
    };
    const uninstallGlobalKeyHandler = () => {
      if (!globalKeyHandler) return;
      window.removeEventListener("keydown", globalKeyHandler, { capture: true });
      globalKeyHandler = null;
    };
    installGlobalKeyHandler();

    const onDoiResolved = createDoiResolvedHandler(workspace, view, onSelectCitekey);
    const updateDropdown = createUpdateDropdown(root, dispatch, onSelectCitekey, onDoiResolved);

    return {
      update(editorView: EditorView, prevState: import("@milkdown/kit/prose/state").EditorState) {
        provider.update(editorView, prevState);
        syncQueryFromEditor(editorView, dispatch);
        const citationState = citationPluginKey.getState(editorView.state) as CitationState | null;
        if (citationState) updateDropdown(citationState);
      },
      destroy() {
        uninstallGlobalKeyHandler();
        provider.destroy();
        root.unmount();
      },
    };
  };
}

/** Load references from workspace and dispatch to state. */
async function loadReferences(
  workspace: WorkspaceAdapter,
  view: EditorView
): Promise<void> {
  try {
    const content = await workspace.readFile("references.bib");
    if (!content) return;

    try {
      const refs = parseBibTeX(content);
      const tr = view.state.tr.setMeta(citationPluginKey, { type: "SET_ITEMS", items: refs });
      view.dispatch(tr);
    } catch {
      // Ignore parse errors - empty list is fine
    }
  } catch (err) {
    // Ignore errors from closed database during Strict Mode cleanup
    if (err instanceof DOMException && err.name === "InvalidStateError") {
      return;
    }
    throw err;
  }
}