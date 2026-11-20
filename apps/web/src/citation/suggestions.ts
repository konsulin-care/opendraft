import type { CrossrefLabel } from '@opendraft/manuscript';
import type { Reference } from '@opendraft/references';
import { filterCitekeys } from './citekey-list';
import type { CitationTrigger } from './types';

/** A single entry in the shared cross-reference/citation suggestion list. */
export type Suggestion =
  | { kind: 'crossref'; key: string; label: CrossrefLabel }
  | { kind: 'citation'; key: string; reference: Reference };

/** Query prefixes that narrow suggestions to one cross-reference kind. */
const KIND_PREFIX_PATTERN = /^(sec|fig|tbl|eq)-/i;

/**
 * Build the combined cross-reference and citation suggestion list.
 *
 * Cross-references are listed before citations and match case-insensitively
 * against the label id or caption. A query starting with `sec-`, `fig-`,
 * `tbl-` or `eq-` narrows the result to that kind and hides citations. When
 * the trigger belongs to a bracket group that already holds a key, only
 * citations are offered.
 *
 * @param items - References loaded from the shared bibliography.
 * @param crossrefs - Cross-reference labels from the current manuscript.
 * @param query - Text typed after `@`.
 * @param trigger - Trigger context, or null when unknown.
 * @returns Cross-reference suggestions followed by citation suggestions.
 */
export function buildSuggestions(
  items: Reference[],
  crossrefs: CrossrefLabel[],
  query: string,
  trigger: CitationTrigger | null,
): Suggestion[] {
  const lowerQuery = query.toLowerCase();
  const prefixMatch = KIND_PREFIX_PATTERN.exec(query);

  if (prefixMatch) {
    const kind = prefixMatch[1].toLowerCase();
    return crossrefs
      .filter((label) => label.kind === kind)
      .filter((label) => matchesLabel(label, lowerQuery))
      .map((label) => ({ kind: 'crossref', key: label.id, label }));
  }

  const crossrefSuggestions: Suggestion[] = trigger?.grouped
    ? []
    : crossrefs
        .filter((label) => matchesLabel(label, lowerQuery))
        .map((label) => ({ kind: 'crossref', key: label.id, label }));

  const citationSuggestions: Suggestion[] = filterCitekeys(items, query).map(
    (reference) => ({ kind: 'citation', key: reference.citeKey, reference }),
  );

  return [...crossrefSuggestions, ...citationSuggestions];
}

/**
 * Check whether a label's id or caption contains the lower-cased query.
 *
 * @param label - Cross-reference label to test.
 * @param lowerQuery - Query already converted to lower case.
 * @returns True when the label matches the query.
 */
function matchesLabel(label: CrossrefLabel, lowerQuery: string): boolean {
  return (
    label.id.toLowerCase().includes(lowerQuery) ||
    label.caption.toLowerCase().includes(lowerQuery)
  );
}
