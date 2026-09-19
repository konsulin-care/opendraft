import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { Node } from '@milkdown/kit/prose/model';
import type { Reference } from '@opendraft/references';

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
 * Match citekeys in text and create decorations.
 *
 * @param text - Text content to search.
 * @param pos - Starting position in document.
 * @param knownCitekeys - Set of valid citekeys.
 * @param citekeyMap - Map to populate with position -> citekey.
 * @returns Array of decoration specs.
 */
function matchCitekeysInText(
  text: string,
  pos: number,
  knownCitekeys: Set<string>,
  citekeyMap?: Map<number, string>,
): Array<{ from: number; to: number; citekey: string }> {
  const results: Array<{ from: number; to: number; citekey: string }> = [];
  const matches = text.matchAll(CITEKEY_PATTERN);

  for (const match of matches) {
    const citekey = match[1];
    if (!knownCitekeys.has(citekey)) continue;

    const from = pos + match.index!;
    const to = from + match[0].length;
    results.push({ from, to, citekey });

    if (citekeyMap) citekeyMap.set(from, citekey);
  }

  return results;
}

/**
 * Build inline decorations for citekeys in the document.
 *
 * @param doc - The ProseMirror document node.
 * @param references - Array of loaded references to match against.
 * @param citekeyMap - Map to populate with position -> citekey mappings.
 * @returns DecorationSet with inline decorations for valid citekeys.
 */
export function buildCitekeyDecorations(
  doc: Node,
  references: Reference[],
  citekeyMap?: Map<number, string>,
): DecorationSet {
  const knownCitekeys = new Set(references.map((r) => r.citeKey));
  const allMatches: Array<{ from: number; to: number; citekey: string }> = [];

  for (const { node, pos } of getTextNodes(doc)) {
    const text = node.text || '';
    allMatches.push(...matchCitekeysInText(text, pos, knownCitekeys, citekeyMap));
  }

  const decorations = allMatches.map(({ from, to, citekey }) =>
    Decoration.inline(from, to, {
      class: 'citekey-link',
      attributes: { 'data-citekey': citekey },
    })
  );

  return DecorationSet.create(doc, decorations);
}
