import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parseBibTeX } from '@opendraft/references';
import { citationReducer, createInitialState } from './state';
import type { CitationState, CitationAction } from './types';
import { matchCitationTrigger } from './input-rule';

/** PluginKey for the citation plugin. */
export const citationPluginKey = new PluginKey('citation');

/**
 * Create the citation plugin for ProseMirror.
 *
 * Handles @citekey trigger detection, state management,
 * and keyboard navigation for the citation dropdown.
 *
 * @param workspace - Workspace adapter for reading references.bib.
 * @returns ProseMirror Plugin instance.
 */
export function createCitationPlugin(workspace: WorkspaceAdapter): Plugin {
  return new Plugin({
    key: citationPluginKey,
    state: createState(),
    props: createProps(),
    view: createView(workspace),
  });
}

/** Create the plugin state spec. */
function createState() {
  return {
    init: () => createInitialState(),
    apply: (tr: Parameters<NonNullable<Parameters<typeof Plugin>[0]['state']>>['0']['apply'][0], prev: CitationState) => {
      const meta = tr.getMeta(citationPluginKey);
      if (meta) {
        return citationReducer(prev, meta);
      }
      return prev;
    },
  };
}

/** Create the plugin props spec. */
function createProps() {
  return {
    handleTextInput: handleTextInput,
    handleDOMEvents: {
      keydown: handleKeydown,
    },
  };
}

/** Handle text input for @ trigger detection. */
function handleTextInput(
  view: EditorView,
  from: number,
  _to: number,
  text: string,
): boolean {
  if (text !== '@') return false;

  const doc = view.state.doc;
  const textBefore = doc.textBetween(Math.max(0, from - 10), from, '', '\n');
  const fullText = textBefore + '@';

  const trigger = matchCitationTrigger(fullText);
  if (!trigger) return false;

  const action: CitationAction = {
    type: 'OPEN_CITATION',
    trigger: { from, bracketed: trigger.bracketed },
  };

  const tr = view.state.tr.setMeta(citationPluginKey, action);
  view.dispatch(tr);
  return false; // Don't consume the @
}

/** Handle keyboard events for navigation. */
function handleKeydown(view: EditorView, event: KeyboardEvent): boolean {
  const citationState = citationPluginKey.getState(view.state) as CitationState | null;
  if (!citationState?.open) return false;

  if (event.key === 'Escape') {
    event.preventDefault();
    dispatchAction(view, { type: 'CLOSE_CITATION' });
    return true;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    dispatchAction(view, { type: 'INCREMENT_ACTIVE_INDEX' });
    return true;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    dispatchAction(view, { type: 'DECREMENT_ACTIVE_INDEX' });
    return true;
  }

  return false;
}

/** Dispatch an action to the citation plugin. */
function dispatchAction(view: EditorView, action: CitationAction): void {
  const tr = view.state.tr.setMeta(citationPluginKey, action);
  view.dispatch(tr);
}

/** Create the plugin view spec. */
function createView(workspace: WorkspaceAdapter) {
  return (view: EditorView) => {
    loadReferences(workspace, view);
    return {
      destroy: () => {},
    };
  };
}

/** Load references from workspace and dispatch to state. */
async function loadReferences(
  workspace: WorkspaceAdapter,
  view: EditorView,
): Promise<void> {
  const content = await workspace.readFile('references.bib');
  if (!content) return;

  try {
    const refs = parseBibTeX(content);
    dispatchAction(view, { type: 'SET_ITEMS', items: refs });
  } catch {
    // Ignore parse errors - empty list is fine
  }
}
