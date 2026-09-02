/**
 * BibTeX parser for OpenDraft references.
 * Parses .bib files into typed Reference objects.
 */

import { readBraceValue, readQuotedValue } from './readers.js';

/** A parsed BibTeX reference entry. */
export interface Reference {
  /** Unique citation key. */
  citeKey: string;
  /** BibTeX entry type (article, book, etc.). */
  entryType: string;
  /** Field values keyed by field name. */
  fields: Record<string, string>;
}

/** Error thrown when BibTeX parsing fails. */
export class BibTeXParseError extends Error {
  /** Line number where the error occurred. */
  readonly line: number;

  constructor(message: string, line: number) {
    super(`BibTeX parse error at line ${line}: ${message}`);
    this.name = 'BibTeXParseError';
    this.line = line;
  }
}

interface ParseState {
  input: string;
  pos: number;
  line: number;
}

/** Skip whitespace and line comments. */
function skipWhitespace(state: ParseState): void {
  while (state.pos < state.input.length) {
    const ch = state.input[state.pos];
    if (ch === '\n') {
      state.line++;
      state.pos++;
    } else if (ch === ' ' || ch === '\t' || ch === '\r') {
      state.pos++;
    } else if (ch === '%') {
      while (state.pos < state.input.length && state.input[state.pos] !== '\n') {
        state.pos++;
      }
    } else {
      break;
    }
  }
}

/** Read a field name (identifier). */
function readFieldName(state: ParseState): string {
  const start = state.pos;
  while (state.pos < state.input.length) {
    const ch = state.input[state.pos];
    const isAlnum = (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9');
    if (isAlnum || ch === '_' || ch === '-' || ch === ':' || ch === '.') {
      state.pos++;
    } else {
      break;
    }
  }
  return state.input.slice(start, state.pos);
}

/** Read an unquoted value (number, month macro, etc.). */
function readUnquotedValue(state: ParseState): string {
  const start = state.pos;
  while (state.pos < state.input.length) {
    const ch = state.input[state.pos];
    if (ch === ',' || ch === '}' || ch === ')' || ch === '\n' || ch === '\r') {
      break;
    }
    state.pos++;
  }
  return state.input.slice(start, state.pos).trim();
}

/** Read and concatenate field values (handles # concatenation). */
function readFieldValue(state: ParseState): string {
  skipWhitespace(state);
  let result = '';
  let expectConcat = false;

  while (state.pos < state.input.length) {
    const ch = state.input[state.pos];
    if (ch === '{') {
      state.pos++;
      result += readBraceValue(state);
      expectConcat = true;
    } else if (ch === '"') {
      state.pos++;
      result += readQuotedValue(state);
      expectConcat = true;
    } else if (ch === '#') {
      if (!expectConcat) {
        throw new BibTeXParseError('unexpected # in value', state.line);
      }
      state.pos++;
      expectConcat = false;
    } else if (ch === ',' || ch === '}' || ch === ')') {
      break;
    } else if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') {
      state.pos++;
    } else if (ch === '%') {
      skipWhitespace(state);
    } else if (!expectConcat) {
      result += readUnquotedValue(state);
      expectConcat = true;
    } else {
      break;
    }
  }

  return result.trim();
}

/** Validate field value exists. */
function validateFieldValue(
  _state: ParseState,
  fieldName: string,
  value: string,
): void {
  if (!value) {
    throw new BibTeXParseError(`empty value for field '${fieldName}'`, _state.line);
  }
}

/** Consume field separator (comma or closing brace). */
function consumeFieldSeparator(state: ParseState, fieldName: string): boolean {
  skipWhitespace(state);
  if (state.pos >= state.input.length) return false;

  const next = state.input[state.pos];
  if (next === ',') {
    state.pos++;
    return true;
  }
  if (next === '}' || next === ')') {
    return false;
  }
  throw new BibTeXParseError(
    `expected ',' or '}' after field '${fieldName}', got '${next}'`,
    state.line,
  );
}

/** Parse fields until closing brace. */
function parseFields(state: ParseState): Record<string, string> {
  const fields: Record<string, string> = {};

  while (state.pos < state.input.length) {
    skipWhitespace(state);
    if (state.pos >= state.input.length) break;

    const ch = state.input[state.pos];
    if (ch === '}' || ch === ')') {
      state.pos++;
      return fields;
    }

    const fieldName = readFieldName(state);
    if (!fieldName) {
      throw new BibTeXParseError('expected field name or closing brace', state.line);
    }

    skipWhitespace(state);
    if (state.pos >= state.input.length || state.input[state.pos] !== '=') {
      throw new BibTeXParseError(`expected '=' after field name '${fieldName}'`, state.line);
    }
    state.pos++;

    const value = readFieldValue(state);
    validateFieldValue(state, fieldName, value);
    fields[fieldName] = value;
    consumeFieldSeparator(state, fieldName);
  }

  throw new BibTeXParseError('unclosed entry', state.line);
}

/** Parse a single BibTeX entry starting after the @type{. */
function parseEntry(state: ParseState, entryType: string): Reference {
  skipWhitespace(state);
  const citeKey = readFieldName(state);
  if (!citeKey) {
    throw new BibTeXParseError('missing cite key', state.line);
  }

  skipWhitespace(state);
  if (state.pos >= state.input.length || state.input[state.pos] !== ',') {
    throw new BibTeXParseError('expected comma after cite key', state.line);
  }
  state.pos++;

  const fields = parseFields(state);
  return { citeKey, entryType, fields };
}

/**
 * Parse a BibTeX .bib string into an array of Reference objects.
 *
 * @param input - Raw BibTeX content string.
 * @returns Array of parsed Reference objects.
 * @throws {BibTeXParseError} If the input is malformed.
 */
export function parseBibTeX(input: string): Reference[] {
  const state: ParseState = { input, pos: 0, line: 1 };
  const references: Reference[] = [];

  while (state.pos < state.input.length) {
    skipWhitespace(state);
    if (state.pos >= state.input.length) break;

    if (state.input[state.pos] === '@') {
      state.pos++;
      skipWhitespace(state);
      const entryType = readFieldName(state);
      if (!entryType) {
        throw new BibTeXParseError('expected entry type after @', state.line);
      }

      skipWhitespace(state);
      if (state.pos >= state.input.length) {
        throw new BibTeXParseError('unexpected end of input after entry type', state.line);
      }
      const openChar = state.input[state.pos];
      if (openChar !== '(' && openChar !== '{') {
        throw new BibTeXParseError(
          `expected '(' or '{' after entry type '${entryType}'`,
          state.line,
        );
      }
      state.pos++;

      references.push(parseEntry(state, entryType));
    } else {
      while (state.pos < state.input.length && state.input[state.pos] !== '@') {
        if (state.input[state.pos] === '\n') state.line++;
        state.pos++;
      }
    }
  }

  if (references.length === 0) {
    throw new BibTeXParseError('no BibTeX entries found', 1);
  }

  return references;
}
