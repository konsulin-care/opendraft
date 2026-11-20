import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { Node } from '@milkdown/kit/prose/model';
import type { Reference } from '@opendraft/references';
import { isCrossrefKey } from '@opendraft/manuscript';
import type { CrossrefLabel, CrossrefKind } from '@opendraft/manuscript';

/** Cross-reference kinds that get a broken-link decoration when unknown. */
const DECORATED_CROSSREF_KINDS = new Set<string>(['sec', 'fig', 'tbl', 'eq']);

/** Trailing punctuation stripped from a matched `@` key before lookup. */
const TRAILING_PUNCTUATION = /[.:-]+$/;

/** A decoration to apply to a matched `@` key. */
interface KeyDecoration {
  from: number;
  to: number;
  attrs: Record<string, string>;
  citekey?: string;
}

/** Lookup tables shared by every text node match. */
interface MatchContext {
  knownCitekeys: Set<string>;
  labelsById: Map<string, CrossrefLabel>;
  citekeyMap?: Map<number, string>;
}
/**
 * Regex pattern to match @citekey within text nodes.
 *
 * Matches @citekey patterns while excluding word-internal @ (like emails).
 * Citekey format: @ + identifier starting with letter/digit/_,
 * containing alphanumerics, _, and internal punctuation characters.
 */
export const CITEKEY_PATTERN = /(?<!\w)@([a-zA-Z0-9_][a-zA-Z0-9_:.#$%&\-+?<>~/]*)/g;

/**
 * Walk all text nodes in a ProseMirror document.
 *
 * @param doc - The ProseMirror document node.
 * @returns Array of { node, pos } for each text node.
 */
function getTextNodes(doc: Node): Array<{ node: Node; pos: number }> {
  const textNodes: Array<{ node: Node; pos: number }> = [];
  doc.descendants((node, pos) => {
    if (node.isText) textNodes.push({ node, pos });
    return true;
  });
  return textNodes;
}

/**
 * Build the decoration for a single cross-reference key, when one applies.
 *
 * @param key - The matched key with trailing punctuation already stripped.
 * @param label - The matching known label, if any.
 * @returns Attribute bag for the decoration, or `null` when undecorated.
 */
function crossrefAttrs(key: string, label: CrossrefLabel | undefined): Record<string, string> | null {
  if (label) {
    return {
      class: 'crossref-link',
      'data-crossref': label.id,
      'data-crossref-kind': label.kind,
      'data-crossref-caption': label.caption,
    };
  }

  const id = key.charAt(0).toLowerCase() + key.slice(1);
  const kind = id.slice(0, id.indexOf('-')) as CrossrefKind;
  if (!DECORATED_CROSSREF_KINDS.has(kind)) return null;
  return { class: 'crossref-broken', 'data-crossref': id };
}

/**
 * Match `@` keys in text and create decoration specs.
 *
 * Cross-reference keys take precedence over citekeys when they match a
 * Quarto prefix; plain keys keep the existing citekey behaviour.
 *
 * @param text - Text content to search.
 * @param pos - Starting position in document.
 * @param context - Lookup tables for citekeys, labels, and position tracking.
 * @returns Array of decoration specs.
 */
function matchKeysInText(
  text: string,
  pos: number,
  context: MatchContext,
): KeyDecoration[] {
  const { knownCitekeys, labelsById, citekeyMap } = context;
  const results: KeyDecoration[] = [];
  const matches = text.matchAll(CITEKEY_PATTERN);

  for (const match of matches) {
    const rawKey = match[1];
    const key = rawKey.replace(TRAILING_PUNCTUATION, '');
    const from = pos + match.index!;

    if (isCrossrefKey(key)) {
      const id = key.charAt(0).toLowerCase() + key.slice(1);
      const attrs = crossrefAttrs(key, labelsById.get(id));
      if (!attrs) continue;
      results.push({ from, to: from + 1 + key.length, attrs });
      continue;
    }

    if (!knownCitekeys.has(rawKey)) continue;

    const to = from + match[0].length;
    results.push({
      from,
      to,
      attrs: { class: 'citekey-link', 'data-citekey': rawKey },
      citekey: rawKey,
    });

    if (citekeyMap) citekeyMap.set(from, rawKey);
  }

  return results;
}

/**
 * Build inline decorations for citekeys and cross-references in the document.
 *
 * @param doc - The ProseMirror document node.
 * @param references - Array of loaded references to match against.
 * @param citekeyMap - Map to populate with position -> citekey mappings.
 * @param crossrefs - Known cross-reference labels from the manuscript.
 * @returns DecorationSet with inline decorations for valid keys.
 */
export function buildCitekeyDecorations(
  doc: Node,
  references: Reference[],
  citekeyMap?: Map<number, string>,
  crossrefs: CrossrefLabel[] = [],
): DecorationSet {
  const context: MatchContext = {
    knownCitekeys: new Set(references.map((r) => r.citeKey)),
    labelsById: new Map(crossrefs.map((label) => [label.id, label])),
    citekeyMap,
  };
  const allMatches: KeyDecoration[] = [];

  for (const { node, pos } of getTextNodes(doc)) {
    const text = node.text || '';
    allMatches.push(...matchKeysInText(text, pos, context));
  }

  const decorations = allMatches.map(({ from, to, attrs }) =>
    Decoration.inline(from, to, attrs, attrs)
  );

  return DecorationSet.create(doc, decorations);
}
