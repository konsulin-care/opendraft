import type { CitationTrigger } from './types';

/**
 * Insert a citation into text at the trigger position.
 *
 * The @ character at trigger.from is replaced with @citekey.
 *
 * @param text - The full text content.
 * @param citekey - The citation key to insert.
 * @param trigger - The trigger context with position and bracketed flag.
 * @returns The text with citation inserted.
 */
export function insertCitation(
  text: string,
  citekey: string,
  trigger: CitationTrigger,
): string {
  // The @ is at trigger.from, replace it with @citekey
  const before = text.slice(0, trigger.from);
  const after = text.slice(trigger.from + 1); // skip the @

  return `${before}@${citekey}${after}`;
}
