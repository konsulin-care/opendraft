import { describe, it, expect } from 'vitest';
import { applyCitekeySelection, insertCitation } from './insert';
import type { CitationTrigger } from './types';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import type { Transaction } from '@milkdown/kit/prose/state';
import { Schema } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';

/** Minimal editor view over a single-paragraph doc for insertion tests. */
function createMockView(text: string, cursorPos: number) {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*' },
      text: { group: 'inline' },
    },
  });
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text(text)),
  ]);
  let state = EditorState.create({
    doc,
    selection: TextSelection.create(doc, cursorPos),
  });
  const view = {
    get state() {
      return state;
    },
    dispatch(tr: Transaction) {
      state = state.apply(tr);
    },
  };
  return { view: view as unknown as EditorView, getState: () => state };
}

describe('insertCitation — non-bracketed', () => {
  it('replaces @query with @citekey (non-bracketed)', () => {
    const trigger: CitationTrigger = { from: 6, bracketed: false };
    const result = insertCitation('hello @world', 'doe2024', trigger, 12);

    expect(result).toBe('hello @doe2024');
  });

  it('replaces @query after whitespace in non-bracketed mode', () => {
    const trigger: CitationTrigger = { from: 0, bracketed: false };
    const result = insertCitation('@hello world', 'doe2024', trigger, 6);

    expect(result).toBe('@doe2024 world');
  });
});

describe('insertCitation — bracketed', () => {
  it('replaces only @query, keeping the [ in bracketed mode', () => {
    const trigger: CitationTrigger = { from: 1, bracketed: true };
    const result = insertCitation('[@world]', 'doe2024', trigger, 7);

    expect(result).toBe('[@doe2024]');
  });

  it('adds closing ] when the group has none after the cursor', () => {
    const trigger: CitationTrigger = { from: 1, bracketed: true };
    const result = insertCitation('[@', 'doe2024', trigger, 2);

    expect(result).toBe('[@doe2024]');
  });

  it('does not duplicate ] when one follows the cursor', () => {
    const trigger: CitationTrigger = { from: 5, bracketed: true };
    const result = insertCitation('[@a; @]', 'b', trigger, 6);

    expect(result).toBe('[@a; @b]');
  });

  it('keeps an existing ] separated by a space', () => {
    const trigger: CitationTrigger = { from: 5, bracketed: true };
    const result = insertCitation('[@a; @ ]', 'b', trigger, 6);

    expect(result).toBe('[@a; @b ]');
  });

  it('does not duplicate ] inside a larger sentence', () => {
    const trigger: CitationTrigger = { from: 9, bracketed: true };
    const result = insertCitation('See [@a; @] here', 'b', trigger, 10);

    expect(result).toBe('See [@a; @b] here');
  });

  it('adds ] when only a later group [ follows before any ]', () => {
    const trigger: CitationTrigger = { from: 5, bracketed: true };
    const result = insertCitation('[@a; @[x]', 'b', trigger, 6);

    expect(result).toBe('[@a; @b][x]');
  });

  it('never removes the [', () => {
    const trigger: CitationTrigger = { from: 1, bracketed: true };
    const result = insertCitation('[@', 'k', trigger, 2);

    expect(result.startsWith('[')).toBe(true);
  });
});

describe('applyCitekeySelection — mock view', () => {
  it('replaces only the @query range in non-bracketed mode', () => {
    const { view, getState } = createMockView('hello @world today', 13);
    applyCitekeySelection(view, 'doe2024', { from: 7, bracketed: false });
    const state = getState();

    expect(state.doc.textContent).toBe('hello @doe2024 today');
    expect(state.selection.from).toBe(15);
  });

  it('appends ] in bracketed mode when the group lacks a closing bracket', () => {
    const { view, getState } = createMockView('[@world', 8);
    applyCitekeySelection(view, 'doe2024', { from: 2, bracketed: true });
    const state = getState();

    expect(state.doc.textContent).toBe('[@doe2024]');
    expect(state.selection.from).toBe(10);
  });

  it('does not duplicate ] when the group already has a closing bracket', () => {
    const { view, getState } = createMockView('[@world]', 8);
    applyCitekeySelection(view, 'doe2024', { from: 2, bracketed: true });
    const state = getState();

    expect(state.doc.textContent).toBe('[@doe2024]');
    expect(state.selection.from).toBe(10);
  });

  it('places the cursor immediately before the closing bracket', () => {
    const { view, getState } = createMockView('[@world', 8);
    applyCitekeySelection(view, 'doe2024', { from: 2, bracketed: true });
    const { $from } = getState().selection;

    expect(
      getState().doc.textBetween($from.pos, $from.end(), undefined, '\uFFFD'),
    ).toBe(']');
  });
});
