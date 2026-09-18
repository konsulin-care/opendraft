import type { CitationTrigger } from './types';

/**
 * Match a citation trigger in the typed text.
 *
 * Matches @ when:
 * - At start of line (bracketed: [@)
 * - After whitespace (text @)
 * - After opening bracket ([@)
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

  // Check for bracketed mode: [@
  const bracketed = atPos > 0 && text[atPos - 1] === '[';

  return {
    from: atPos,
    bracketed,
  };
}
