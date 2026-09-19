import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { DecorationSet } from "@milkdown/kit/prose/view";
import { SlashProvider } from "@milkdown/plugin-slash";
import type { WorkspaceAdapter } from "@opendraft/workspace";
import { parseBibTeX } from "@opendraft/references";
import type { Reference } from "@opendraft/references";
import { citationReducer, createInitialState } from "./state";
import { matchCitationTrigger } from "./input-rule";
import { filterCitekeys } from "./citekey-list";
import type { CitationState, CitationAction } from "./types";
import { createRoot } from "react-dom/client";
import React from "react";
import { CitationDropdown } from "./dropdown";
import { appendReference } from "./file-write";
import { buildCitekeyDecorations } from "./citekey-decoration";
import { handleClickEvent, handleMouseOver, handleMouseOut, hideTooltip } from "./citekey-interactions";

/** PluginKey for the citation plugin. */
export const citationPluginKey = new PluginKey("citation");

/** Decoration state key for managing citekey decorations. */
const decoStateKey = new PluginKey("citation-decorations");

/** Citekey map for tracking position -> citekey mappings. */
const citekeyMap = new Map<number, string>();

/**
 * Create the citation plugin for ProseMirror.
 *
 * @param workspace - Workspace adapter for reading references.bib.
 * @param onStateChange - Optional callback fired on every state transition.
 * @returns ProseMirror Plugin instance.
 */
export function createCitationPlugin(
  workspace: WorkspaceAdapter,
  onStateChange?: (state: CitationState) => void
): Plugin {
  return new Plugin({
    key: citationPluginKey,
    state: createState(onStateChange),
    props: {
      decorations: (state) => decoStateKey.getState(state) || DecorationSet.empty,
    },
    view: createView(workspace),
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
  return selection.$head.parentOffset === selection.$head.parent.content.size;
}

/** Check whether the citation dropdown should be shown. */
function shouldShowCitation(
  content: string | undefined,
  state: import("@milkdown/kit/prose/state").EditorState
): boolean {
  if (!content) return false;
  if (!matchCitationTrigger(content)) return false;
  return isSelectionAtEndOfNode(state);
}

/** Rebuild decorations based on current document and references. */
function rebuildDecorations(view: EditorView, references: Reference[]) {
  citekeyMap.clear();
  const decoSet = buildCitekeyDecorations(view.state.doc, references, citekeyMap);
  const tr = view.state.tr.setMeta(decoStateKey, { decorations: decoSet });
  view.dispatch(tr);
}



/** Set up DOM event delegation on editor container (click + tooltips). */
function setupDOMHandlers(view: EditorView) {
  const { dom } = view;
  const onClick = (e: Event) => handleClickEvent(view, e);
  const onMouseOver = (e: MouseEvent) => handleMouseOver(view, e);
  const onMouseOut = (e: MouseEvent) => handleMouseOut(view, e);
  dom.addEventListener("click", onClick);
  dom.addEventListener("mouseover", onMouseOver);
  dom.addEventListener("mouseout", onMouseOut);
  return {
    destroy() {
      dom.removeEventListener("click", onClick);
      dom.removeEventListener("mouseover", onMouseOver);
      dom.removeEventListener("mouseout", onMouseOut);
    },
  };
}

/** Create the plugin view spec. */
function createView(workspace: WorkspaceAdapter) {
  return (view: EditorView) => {
    loadReferences(workspace, view);
    const dispatch = createDispatch(view);
    const { provider, root } = createSlashProviderConfig(dispatch, view);
    const globalKeyHandler = createGlobalKeyHandler(view, dispatch);
    window.addEventListener("keydown", globalKeyHandler, { capture: true });
    const domHandlers = setupDOMHandlers(view);
    const onDoiResolved = createDoiResolvedHandler(workspace, view);
    const updateDropdown = createUpdateDropdown(root, dispatch, onDoiResolved);

    setTimeout(() => {
      const state = citationPluginKey.getState(view.state) as CitationState;
      if (state?.items) rebuildDecorations(view, state.items);
    }, 0);

    return {
      update(editorView: EditorView, prevState: import("@milkdown/kit/prose/state").EditorState) {
        provider.update(editorView, prevState);
        syncQueryFromEditor(editorView, dispatch);
        const state = citationPluginKey.getState(editorView.state) as CitationState | null;
        if (state) updateDropdown(state);
        if (editorView.state.doc !== prevState.doc) {
          const citeState = citationPluginKey.getState(editorView.state) as CitationState;
          if (citeState?.items) rebuildDecorations(editorView, citeState.items);
        }
      },
      destroy() {
        window.removeEventListener("keydown", globalKeyHandler, { capture: true });
        domHandlers.destroy();
        provider.destroy();
        root.unmount();
        hideTooltip();
        citekeyMap.clear();
      },
    };
  };
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
    floatingUIOptions: { placement: "bottom-start" },
    shouldShow: (editorView): boolean =>
      shouldShowCitation(provider.getContent(editorView), editorView.state),
  });

  provider.element.style.position = "absolute";

  provider.onShow = () => {
    const { selection } = view.state;
    const $from = selection.$from;
    const paragraphText = $from.parent.textBetween(0, $from.parentOffset, undefined, "\uFFFD");
    const trigger = matchCitationTrigger(paragraphText);
    if (!trigger) return;

    dispatch({
      type: "OPEN_CITATION",
      trigger: { from: $from.start() + trigger.from, bracketed: trigger.bracketed },
    });
  };

  provider.onHide = () => dispatch({ type: "CLOSE_CITATION" });

  return { provider, container, root };
}

/** Create dropdown update function. */
function createUpdateDropdown(
  root: ReturnType<typeof createRoot>,
  dispatch: (action: CitationAction) => void,
  onDoiResolved?: (bibtex: string) => void
) {
  return (state: CitationState) => {
    root.render(
      React.createElement(CitationDropdown, { state, dispatch, onDoiResolved })
    );
  };
}

/** Create the global keyboard handler for the citation dropdown. */
function createGlobalKeyHandler(
  view: EditorView,
  dispatch: (action: CitationAction) => void
) {
  return (event: KeyboardEvent) => {
    const state = citationPluginKey.getState(view.state) as CitationState;
    if (!state?.open) return;

    switch (event.key) {
      case "Enter": {
        if (state.doiMode) return;
        event.preventDefault();
        const filtered = filterCitekeys(state.items, state.query);
        if (filtered.length > 0 && state.activeIndex < filtered.length) {
          const citekey = filtered[state.activeIndex].citeKey;
          if (state.trigger) {
            const insertText = state.trigger.bracketed ? `[@${citekey}]` : `@${citekey}`;
            const cursorPos = view.state.selection.$from.pos;
            const tr = view.state.tr;
            tr.insertText(insertText, state.trigger.from, cursorPos);
            view.dispatch(tr);
          }
        }
        dispatch({ type: "CLOSE_CITATION" });
        break;
      }
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
function extractQueryFromEditor(view: EditorView, triggerFrom: number): string {
  const { $from } = view.state.selection;
  return view.state.doc.textBetween(
    Math.min(triggerFrom + 1, $from.pos),
    $from.pos,
    undefined,
    "\uFFFD"
  );
}

/** Create the onDoiResolved handler for DOI resolution flow. */
function createDoiResolvedHandler(workspace: WorkspaceAdapter, view: EditorView) {
  return async (bibtex: string) => {
    await appendReference(workspace, bibtex);
    await loadReferences(workspace, view);
  };
}

/** Sync query from editor text when dropdown is open. */
function syncQueryFromEditor(editorView: EditorView, dispatch: (action: CitationAction) => void) {
  const state = citationPluginKey.getState(editorView.state) as CitationState | null;
  if (!state?.open || !state.trigger) return;
  const query = extractQueryFromEditor(editorView, state.trigger.from);
  if (query !== state.query) dispatch({ type: "SET_QUERY", query });
}

/** Load references from workspace and dispatch to state. */
async function loadReferences(workspace: WorkspaceAdapter, view: EditorView): Promise<void> {
  try {
    const content = await workspace.readFile("references.bib");
    if (!content) return;

    try {
      const refs = parseBibTeX(content);
      const tr = view.state.tr.setMeta(citationPluginKey, { type: "SET_ITEMS", items: refs });
      view.dispatch(tr);
      setTimeout(() => rebuildDecorations(view, refs), 0);
    } catch {
      // Ignore parse errors
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "InvalidStateError") return;
    throw err;
  }
}
