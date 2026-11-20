import { Scalar, type Document } from 'yaml';

/**
 * Normalize abstract text for literal-block output.
 *
 * Trailing whitespace and newlines are trimmed and exactly one newline is
 * appended so the emitter chooses clip chomping (`|`), never `|-` or `|+`.
 *
 * @param text - Raw abstract text from the editor.
 * @returns Text ending in exactly one newline, or '' for blank input.
 */
function normalize(text: string): string {
  return text.trimEnd() === '' ? '' : `${text.trimEnd()}\n`;
}

/**
 * Write the abstract of a metadata YAML document as a literal block scalar.
 *
 * Empty or whitespace-only text writes `abstract: ""` to match the template
 * default. Otherwise the text becomes a clip-chomped block literal: indented
 * and emitted without escaping quotes or reflowing lines.
 *
 * @param doc - Parsed YAML document of `_abstract.yml` to mutate.
 * @param text - Raw abstract text from the editor.
 */
export function setAbstractLiteral(doc: Document, text: string): void {
  const normalized = normalize(text);
  if (normalized === '') {
    doc.set('abstract', '');
    return;
  }
  const node = new Scalar(normalized);
  node.type = Scalar.BLOCK_LITERAL;
  doc.set('abstract', node);
}
