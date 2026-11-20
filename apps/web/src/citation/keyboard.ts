import type { EditorView } from "@milkdown/kit/prose/view";
import { applyCitekeySelection } from "./insert";
import { citationPluginKey } from "./plugin";
import type { CitationPluginState } from "./plugin";
import { buildSuggestions } from "./suggestions";
import type { CitationAction, CitationState } from "./types";

/**
 * Resolve the key that Enter should insert for the current citation state.
 *
 * Reads the combined cross-reference/citation suggestion list and returns
 * the key at the active index. Grouped triggers only contain citations, so
 * the result is a citekey in that case.
 *
 * @param state - Current citation state with items, crossrefs, query and trigger.
 * @returns The selected suggestion key, or null when no suggestion is active.
 */
export function resolveEnterKey(state: CitationState): string | null {
  const suggestions = buildSuggestions(
    state.items,
    state.crossrefs ?? [],
    state.query,
    state.trigger,
  );
  return suggestions[state.activeIndex]?.key ?? null;
}

/**
 * Create the global keyboard handler for the citation dropdown.
 *
 * Handles Enter (insert the active suggestion), arrow navigation and Escape.
 * Registered by the plugin on window in the capture phase so it wins over
 * editor keymaps.
 *
 * @param view - Editor view that owns the citation plugin.
 * @param dispatch - Dispatches citation actions to the plugin state.
 * @returns A keydown listener for window keydown events.
 */
export function createGlobalKeyHandler(
  view: EditorView,
  dispatch: (action: CitationAction) => void,
) {
  return (event: KeyboardEvent) => {
    const ps = citationPluginKey.getState(view.state) as CitationPluginState | null;
    const state = ps?.citation;
    if (!state?.open) return;

    switch (event.key) {
      case "Enter": {
        if (state.doiMode) return;
        event.preventDefault();
        const key = resolveEnterKey(state);
        if (key && state.trigger) {
          applyCitekeySelection(view, key, state.trigger);
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
