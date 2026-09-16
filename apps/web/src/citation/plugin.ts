import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { SlashProvider } from "@milkdown/plugin-slash";
import type { WorkspaceAdapter } from "@opendraft/workspace";
import { parseBibTeX } from "@opendraft/references";
import { citationReducer, createInitialState } from "./state";
import type { CitationState, CitationAction } from "./types";
import { createRoot } from "react-dom/client";
import React from "react";
import { CitationDropdown } from "./dropdown";

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
      tr: Parameters<NonNullable<Parameters<typeof Plugin>[0]["state"]>>["0"]["apply"][0],
      prev: CitationState
    ) => {
      const meta = tr.getMeta(citationPluginKey);
      const next = meta ? citationReducer(prev, meta) : prev;
      onStateChange?.(next);
      return next;
    },
  };
}

/** Create the plugin props spec (no custom handlers needed). */
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
    shouldShow: (editorView) => {
      const content = provider.getContent(editorView);
      if (!content) return false;

      const lastChar = content[content.length - 1];
      if (lastChar !== "@") return false;

      const atPos = content.length - 1;
      if (atPos === 0) return true;

      const charBefore = content[atPos - 1];
      return charBefore === "[" || /\s/.test(charBefore);
    },
    onShow: () => {
      const state = view.state;
      const { selection } = state;
      const from = selection.$from.pos - 1;
      const textBefore = state.doc.textBetween(Math.max(0, from - 1), from);
      const bracketed = textBefore === "[";

      dispatch({
        type: "OPEN_CITATION",
        trigger: { from, bracketed, top: 0, left: 0 },
      });
    },
    onHide: () => {
      dispatch({ type: "CLOSE_CITATION" });
    },
  });

  return { provider, container, root };
}

/** Create dropdown update function. */
function createUpdateDropdown(
  root: ReturnType<typeof createRoot>,
  dispatch: (action: CitationAction) => void,
  view: EditorView,
  onSelectCitekey?: CitationSelectHandler
) {
  return (state: CitationState) => {
    root.render(
      React.createElement(CitationDropdown, {
        state,
        dispatch,
        onSelectCitekey,
        scrollContainerRef: { current: view.dom.parentElement },
      })
    );
  };
}

/** Create the plugin view spec. */
function createView(workspace: WorkspaceAdapter, onSelectCitekey?: CitationSelectHandler) {
  return (view: EditorView) => {
    loadReferences(workspace, view);

    const dispatch = createDispatch(view);
    const { provider, root } = createSlashProviderConfig(dispatch, view);
    const updateDropdown = createUpdateDropdown(root, dispatch, view, onSelectCitekey);

    return {
      update(editorView: EditorView, prevState: import("@milkdown/kit/prose/state").EditorState) {
        provider.update(editorView, prevState);
        const citationState = citationPluginKey.getState(editorView.state) as CitationState | null;
        if (citationState) {
          updateDropdown(citationState);
        }
      },
      destroy() {
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
  const content = await workspace.readFile("references.bib");
  if (!content) return;

  try {
    const refs = parseBibTeX(content);
    const tr = view.state.tr.setMeta(citationPluginKey, { type: "SET_ITEMS", items: refs });
    view.dispatch(tr);
  } catch {
    // Ignore parse errors - empty list is fine
  }
}