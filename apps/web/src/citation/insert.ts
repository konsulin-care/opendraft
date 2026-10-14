import type { CitationTrigger } from './types';

/** Planned text replacement for a selected citation. */
export interface CitationInsertion {
  /** Start offset of the replaced range (the @ position). */
  from: number;
  /** End offset of the replaced range (the cursor position). */
  to: number;
  /** Replacement text: "@citekey" plus "]" when the group lacks one. */
  text: string;
}

/**
 * Check whether the bracket group at the cursor already has a closing ].
 *
 * Scans the text after the cursor and stops at the start of a new bracket
 * group. A ] found first means the current group is already closed.
 *
 * @param textAfterCursor - Text following the cursor.
 * @returns True when a closing ] belongs to the current group.
 */
function groupHasClosingBracket(textAfterCursor: string): boolean {
  for (const char of textAfterCursor) {
    if (char === ']') return true;
    if (char === '[') return false;
  }
  return false;
}

/**
 * Plan the replacement performed when a citation is picked.
 *
 * Replaces only the "@query" range [trigger.from, cursor); the opening [
 * is never consumed. In bracketed mode a closing ] is appended only when
 * the group has none after the cursor, so ] is never duplicated.
 *
 * @param cursor - Cursor position in the same offset space as trigger.from.
 * @param citekey - The picked citation key.
 * @param trigger - Trigger context with the @ position.
 * @param textAfterCursor - Text following the cursor in the current block.
 * @returns The range to replace and the text to insert.
 */
export function planCitationInsertion(
  cursor: number,
  citekey: string,
  trigger: CitationTrigger,
  textAfterCursor: string,
): CitationInsertion {
  let text = `@${citekey}`;
  if (trigger.bracketed && !groupHasClosingBracket(textAfterCursor)) {
    text += ']';
  }
  return { from: trigger.from, to: cursor, text };
}

/**
 * Insert a citation into text at the trigger position.
 *
 * Replaces only the "@query" text (from the @ to the cursor); an opening [
 * is preserved. A closing ] is added in bracketed mode only when the group
 * has none after the cursor.
 *
 * @param text - The full text content.
 * @param citekey - The citation key to insert.
 * @param trigger - The trigger context with position and bracketed flag.
 * @param cursor - Cursor offset within text (defaults to end of text).
 * @returns The text with the citation inserted.
 */
export function insertCitation(
  text: string,
  citekey: string,
  trigger: CitationTrigger,
  cursor: number = text.length,
): string {
  const insertion = planCitationInsertion(
    cursor,
    citekey,
    trigger,
    text.slice(cursor),
  );
  return text.slice(0, insertion.from) + insertion.text + text.slice(insertion.to);
}
