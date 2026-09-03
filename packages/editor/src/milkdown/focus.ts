import type { Node } from '@milkdown/kit/prose/model';

/** Focus mode state: one focused section id, or the whole document. */
export interface FocusState {
  focused: string | null;
}

/**
 * Start (or reset) focus mode with no focused section.
 *
 * @param _state - Current state (ignored).
 * @returns A fresh unfocused state.
 */
export function clearFocus(_state?: FocusState): FocusState {
  return { focused: null };
}

/**
 * Focus a single section by id.
 *
 * @param _state - Current state (ignored).
 * @param id - Section id to focus.
 * @returns A state focused on the section.
 */
export function focusSection(_state: FocusState, id: string): FocusState {
  return { focused: id };
}

/**
 * Id of the focused section, if any.
 *
 * @param state - Focus state.
 * @returns The focused section id or null.
 */
export function focusedSectionId(state: FocusState): string | null {
  return state.focused;
}

/**
 * Ids of sections that should be dimmed: every section but the focused
 * one when focus mode is active, else none.
 *
 * @param doc - The manuscript document.
 * @param state - Focus state.
 * @returns Section ids to dim, in document order.
 */
export function dimmedSectionIds(doc: Node, state: FocusState): string[] {
  if (!state.focused) return [];
  const dimmed: string[] = [];
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (child.type.name === 'section' && child.attrs.id !== state.focused) {
      dimmed.push(String(child.attrs.id));
    }
  }
  return dimmed;
}