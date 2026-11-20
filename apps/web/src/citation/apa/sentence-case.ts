import { cleanLatex } from './latex';

/** A title token: either a brace-protected group or an unprotected chunk. */
interface SentenceToken {
  text: string;
  protectedGroup: boolean;
  spaceBefore: boolean;
}

/** Returns true when the token ends a sentence or clause. */
function endsSentence(text: string): boolean {
  return /[:?!]\s*$/.test(text);
}

/**
 * Find the end index of the brace group that starts at `start`.
 *
 * @param raw - Raw title text.
 * @param start - Index of the opening brace.
 * @returns Index just past the matching closing brace.
 */
function braceGroupEnd(raw: string, start: number): number {
  let depth = 0;
  for (let index = start; index < raw.length; index += 1) {
    if (raw[index] === '{') depth += 1;
    else if (raw[index] === '}') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return raw.length;
}

/**
 * Find the end index of the unprotected word that starts at `start`.
 *
 * @param raw - Raw title text.
 * @param start - Index of the first word character.
 * @returns Index just past the word.
 */
function wordEnd(raw: string, start: number): number {
  let end = start;
  while (end < raw.length && !/\s/.test(raw[end]) && raw[end] !== '{') {
    end += 1;
  }
  return end;
}

/** Splits a raw title into protected brace groups and unprotected tokens. */
function tokenize(raw: string): SentenceToken[] {
  const tokens: SentenceToken[] = [];
  let pendingSpace = false;
  let index = 0;

  while (index < raw.length) {
    const char = raw[index];
    if (/\s/.test(char)) {
      pendingSpace = tokens.length > 0;
      index += 1;
      continue;
    }

    const protectedGroup = char === '{';
    const end = protectedGroup ? braceGroupEnd(raw, index) : wordEnd(raw, index);
    tokens.push({
      text: raw.slice(index, end),
      protectedGroup,
      spaceBefore: pendingSpace,
    });
    pendingSpace = false;
    index = end;
  }

  return tokens;
}

/** Returns true when a word is all capitals with two or more letters. */
function isAllCaps(word: string): boolean {
  return word.length >= 2 && /^[A-Z]+$/.test(word);
}

/** Returns true when a word has an uppercase letter after its first character. */
function hasInternalUpper(word: string): boolean {
  return /[A-Z]/.test(word.slice(1));
}

/** Applies sentence casing to a single word. */
function caseWord(word: string, capitalize: boolean): string {
  if (isAllCaps(word) || hasInternalUpper(word)) return word;
  const lower = word.toLowerCase();
  if (!capitalize) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Apply sentence casing to a raw BibTeX title.
 *
 * Keeps brace-protected groups, all-caps words and mixed-case words as
 * written, lowercases other words, capitalizes the first word and the first
 * word after sentence punctuation, then cleans the result with
 * {@link cleanLatex}.
 *
 * @param rawTitle - Raw BibTeX title, protective braces included.
 * @returns Display-ready sentence-cased title.
 */
export function sentenceCase(rawTitle: string): string {
  const tokens = tokenize(rawTitle);
  let capitalizeNext = true;
  let output = '';

  for (const token of tokens) {
    if (token.spaceBefore) output += ' ';

    if (token.protectedGroup) {
      output += token.text;
      capitalizeNext = endsSentence(token.text);
      continue;
    }

    const cased = token.text.replace(
      /(?<!\\)[A-Za-z]+(?:['\u2019][A-Za-z]+)*/g,
      (word: string) => {
        const result = caseWord(word, capitalizeNext);
        capitalizeNext = false;
        return result;
      },
    );
    output += cased;
    if (endsSentence(token.text)) capitalizeNext = true;
  }

  return cleanLatex(output);
}
