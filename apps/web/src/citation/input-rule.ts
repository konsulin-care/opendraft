import type { CitationTrigger } from './types';

/**
 * Check whether the @ sits inside an unclosed bracket group.
 *
 * Tracks [ and ] nesting in the text before the @: any [ still open at
 * the @ position means the @ belongs to a bracket group, even when it is
 * not directly preceded by [ (e.g. the second citation in "[@a; @").
 *
 * @param textBefore - Text preceding the @ character.
 * @returns True when inside an unclosed bracket group.
 */
function insideBracketGroup(textBefore: string): boolean {
  return openBracketIndex(textBefore) !== -1;
}

/**
 * Index of the last unclosed `[` in the text, or -1 when none is open.
 *
 * @param textBefore - Text preceding the @ character.
 * @returns Index of the unclosed bracket, or -1.
 */
function openBracketIndex(textBefore: string): number {
  let depth = 0;
  let openIndex = -1;
  for (let i = 0; i < textBefore.length; i += 1) {
    const char = textBefore[i];
    if (char === '[') {
      depth += 1;
      openIndex = i;
    } else if (char === ']' && depth > 0) {
      depth -= 1;
      if (depth === 0) openIndex = -1;
    }
  }
  return depth > 0 ? openIndex : -1;
}

/**
 * Match a citation trigger in the typed text.
 *
 * Matches @ when:
 * - At start of line (bracketed: [@)
 * - After whitespace (text @)
 * - After opening bracket ([@)
 * - After a semicolon inside a bracket group ([@a; @)
 *
 * Does NOT match @ inside words (email@, test@).
 *
 * @param text - The text before and including the @ character.
 * @returns Trigger info if matched, null otherwise.
 */
export function matchCitationTrigger(text: string): CitationTrigger | null {
  if (!text || !text.endsWith('@')) return null;

  const atPos = text.length - 1;

  // Check if character before @ is a word character (letter, digit, underscore)
  if (atPos > 0) {
    const charBefore = text[atPos - 1];
    if (/[a-zA-Z0-9_]/.test(charBefore)) {
      return null;
    }
  }

  // Bracketed mode: directly after [, or a later @ inside an unclosed group.
  const textBefore = text.slice(0, atPos);
  const bracketed = (atPos > 0 && text[atPos - 1] === '[') || insideBracketGroup(textBefore);

  // Grouped: the unclosed bracket already holds an earlier @ key.
  const openIndex = bracketed ? openBracketIndex(textBefore) : -1;
  const grouped = openIndex !== -1 && textBefore.slice(openIndex + 1).includes('@');

  return {
    from: atPos,
    bracketed,
    grouped,
  };
}
