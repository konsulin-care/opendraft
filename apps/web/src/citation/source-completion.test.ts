import { describe, expect, it } from 'vitest';
import { CompletionContext } from '@codemirror/autocomplete';
import type { Completion, CompletionResult } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import type { Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { CrossrefLabel } from '@opendraft/manuscript';
import type { Reference } from '@opendraft/references';
import { createAtCompletionSource } from './source-completion';
import type { AtCompletionProvider } from './source-completion';

const references: Reference[] = [
  {
    citeKey: 'doe2024',
    entryType: 'article',
    fields: { title: 'Figure of a cat', author: 'Doe, Jane', year: '2024' },
  },
];

const crossrefs: CrossrefLabel[] = [
  { id: 'fig-cat', kind: 'fig', caption: 'A cat diagram', file: 'intro.qmd' },
  { id: 'sec-intro', kind: 'sec', caption: 'Introduction', file: 'intro.qmd' },
];

const provider: AtCompletionProvider = {
  getReferences: async () => references,
  getCrossrefs: () => crossrefs,
};

/** Run the completion source against a document with the cursor at pos. */
async function complete(doc: string, pos: number = doc.length): Promise<CompletionResult | null> {
  const source = createAtCompletionSource(provider);
  const context = new CompletionContext(EditorState.create({ doc }), pos, true);
  return source(context) as Promise<CompletionResult | null>;
}

describe('createAtCompletionSource', () => {
  it('for "see @" returns cross-reference options before citation options, starting at the @ position', async () => {
    const result = await complete('see @');

    expect(result).not.toBeNull();
    expect(result!.from).toBe(4);
    expect(result!.filter).toBe(false);
    expect(result!.options.map((option) => option.label)).toEqual([
      '@fig-cat',
      '@sec-intro',
      '@doe2024',
    ]);
    expect(result!.options.map((option) => option.section)).toEqual([
      'Cross-references',
      'Cross-references',
      'Citations',
    ]);
    expect(result!.options.map((option) => option.detail)).toEqual([
      'A cat diagram',
      'Introduction',
      'Jane Doe (2024)',
    ]);
  });

  it('for "mail@" returns null', async () => {
    expect(await complete('mail@')).toBeNull();
  });

  it('for "[@a; @" returns only citation options', async () => {
    const result = await complete('[@a; @');

    expect(result).not.toBeNull();
    expect(result!.from).toBe(5);
    expect(result!.options.map((option) => option.label)).toEqual(['@doe2024']);
    expect(result!.options.every((option) => option.section === 'Citations')).toBe(true);
  });
});

describe('createAtCompletionSource apply', () => {
  it('inserts the planned citation text over the typed @query range', async () => {
    const doc = 'see @fig';
    const state = EditorState.create({ doc });
    const result = await complete(doc);
    const option = result!.options.find((item) => item.label === '@fig-cat') as Completion;
    let dispatched: Transaction | null = null;
    const view = {
      state,
      dispatch: (transaction: Transaction) => {
        dispatched = transaction;
      },
    } as unknown as EditorView;

    expect(typeof option.apply).toBe('function');
    if (typeof option.apply !== 'function') return;
    option.apply(view, option, result!.from, doc.length);

    expect(dispatched).not.toBeNull();
    expect(dispatched!.state.doc.toString()).toBe('see @fig-cat');
  });
});
