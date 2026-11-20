import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import type { CrossrefLabel } from '@opendraft/manuscript';
import type { Reference } from '@opendraft/references';
import { formatAuthor } from './citekey-item';
import { matchCitationTrigger } from './input-rule';
import { planCitationInsertion } from './insert';
import { buildSuggestions } from './suggestions';
import type { Suggestion } from './suggestions';

/** Async sources the `@` completion reads its suggestions from. */
export interface AtCompletionProvider {
  /** Load the bibliography entries from the shared references.bib. */
  getReferences(): Promise<Reference[]>;
  /** Return the cross-reference labels of the current manuscript. */
  getCrossrefs(): CrossrefLabel[];
}

/** Characters that end the citation query and therefore the `@` trigger. */
const QUERY_BREAK_PATTERN = /[\s;[\]]/;

/**
 * Find the position of the `@` that starts the completion query.
 *
 * The trigger is the last `@` on the line before the cursor, provided no
 * whitespace, `;`, `[` or `]` appears between it and the cursor.
 *
 * @param text - Document text from the start of the line up to the cursor.
 * @returns The `@` offset within text, or -1 when there is no trigger.
 */
function findAtPosition(text: string): number {
  const atPos = text.lastIndexOf('@');
  if (atPos === -1) return -1;
  const query = text.slice(atPos + 1);
  return QUERY_BREAK_PATTERN.test(query) ? -1 : atPos;
}

/**
 * Build the detail line for a suggestion: the label caption, or the first
 * author and year for a bibliography entry.
 *
 * @param suggestion - Suggestion being rendered.
 * @returns A short description for the completion row.
 */
function detailOf(suggestion: Suggestion): string {
  if (suggestion.kind === 'crossref') return suggestion.label.caption;

  const { fields, citeKey } = suggestion.reference;
  const author = formatAuthor(fields.author) ?? citeKey;
  return fields.year ? `${author} (${fields.year})` : author;
}

/**
 * Create a CodeMirror completion source for Quarto `@` cross-references and
 * BibTeX citations.
 *
 * The source reads the text before the cursor, matches the citation trigger,
 * and returns the shared cross-reference/citation suggestion list. Applying an
 * option replaces the typed `@query` range with the plan from
 * `planCitationInsertion`, so bracket handling matches the block editor.
 *
 * @param provider - Source of references and cross-reference labels.
 * @returns A completion source usable with `autocompletion`.
 */
export function createAtCompletionSource(provider: AtCompletionProvider): CompletionSource {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const textBeforeCursor = ctx.state.sliceDoc(line.from, ctx.pos);
    const atPos = findAtPosition(textBeforeCursor);
    if (atPos === -1) return null;

    const triggerText = textBeforeCursor.slice(0, atPos + 1);
    const trigger = matchCitationTrigger(triggerText);
    if (!trigger) return null;

    const query = textBeforeCursor.slice(atPos + 1);
    const references = await provider.getReferences();
    const suggestions = buildSuggestions(references, provider.getCrossrefs(), query, trigger);
    const options = suggestions.map((suggestion) => createOption(suggestion, trigger, ctx.pos));

    return { from: atPos + line.from, filter: false, options };
  };
}

/**
 * Convert one suggestion into a CodeMirror completion option.
 *
 * @param suggestion - Shared cross-reference or citation suggestion.
 * @param trigger - Trigger context used by the insertion planner.
 * @param cursor - Document offset where the typed query ends.
 * @returns Completion option with label, section, detail and apply handler.
 */
function createOption(
  suggestion: Suggestion,
  trigger: NonNullable<ReturnType<typeof matchCitationTrigger>>,
  cursor: number,
): Completion {
  return {
    label: `@${suggestion.key}`,
    section: suggestion.kind === 'crossref' ? 'Cross-references' : 'Citations',
    detail: detailOf(suggestion),
    apply: (view, _completion, _from, to) => {
      const insertion = planCitationInsertion(
        cursor,
        suggestion.key,
        trigger,
        view.state.sliceDoc(to),
      );
      view.dispatch(
        view.state.update({
          changes: { from: insertion.from, to: insertion.to, insert: insertion.text },
        }),
      );
    },
  };
}
