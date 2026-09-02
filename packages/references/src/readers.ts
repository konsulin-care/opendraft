/**
 * Value readers for BibTeX parser.
 * Handles brace-delimited and quoted values.
 */

import { BibTeXParseError } from './parser.js';

interface ParseState {
  input: string;
  pos: number;
  line: number;
}

/** Read a brace-delimited value, handling nested braces. */
export function readBraceValue(state: ParseState): string {
  const start = state.pos;
  let depth = 0;
  while (state.pos < state.input.length) {
    const ch = state.input[state.pos];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      if (depth === 0) break;
      depth--;
    } else if (ch === '\\') {
      state.pos++;
    } else if (ch === '\n') {
      state.line++;
    }
    state.pos++;
  }
  if (state.pos >= state.input.length) {
    throw new BibTeXParseError('unclosed brace in value', state.line);
  }
  const value = state.input.slice(start, state.pos);
  state.pos++;
  return value;
}

/** Read a quoted value, handling nested braces. */
export function readQuotedValue(state: ParseState): string {
  const start = state.pos;
  let depth = 0;
  while (state.pos < state.input.length) {
    const ch = state.input[state.pos];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
    } else if (ch === '"') {
      if (depth === 0) break;
    } else if (ch === '\\') {
      state.pos++;
    } else if (ch === '\n') {
      state.line++;
    }
    state.pos++;
  }
  if (state.pos >= state.input.length) {
    throw new BibTeXParseError('unclosed quote in value', state.line);
  }
  const value = state.input.slice(start, state.pos);
  state.pos++;
  return value;
}
