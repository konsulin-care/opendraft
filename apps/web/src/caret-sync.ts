import type { Node } from '@milkdown/kit/prose/model';
import { Transform } from '@milkdown/kit/prose/transform';

/**
 * Private-use sentinel character inserted at the caret during a mode switch.
 * It survives markdown serialization and parsing as plain text, letting us
 * locate the caret offset in the other representation.
 */
export const CARET_SENTINEL = '\u{E000}';

/** Document start position, used when the sentinel is lost in a round trip. */
export const DOCUMENT_START = 0;

/** Input for mapping a visual (ProseMirror) caret to a markdown offset. */
export interface VisualCaretInput {
  /** Current ProseMirror document. */
  doc: Node;
  /** ProseMirror selection position to map. */
  pos: number;
  /** Serializer (e.g. Milkdown serializerCtx) rendering a doc to markdown. */
  serialize: (doc: Node) => string;
}

/** Input for mapping a markdown offset back to a ProseMirror position. */
export interface SourceCaretInput {
  /** Markdown source text. */
  markdown: string;
  /** Character offset in the markdown (CodeMirror cursor position). */
  offset: number;
  /** Parser (e.g. Milkdown parserCtx) rendering markdown to a ProseMirror doc. */
  parse: (markdown: string) => Node | null;
}

/** Result of mapping a markdown offset back to a ProseMirror position. */
export interface SourceCaretResult {
  /** ProseMirror position of the caret; document start when the sentinel is lost. */
  pos: number;
  /** Parsed document with the sentinel removed; null when parsing failed. */
  doc: Node | null;
  /** True when the sentinel was found; false means the position is a fallback. */
  found: boolean;
}

/**
 * Map a visual caret position to its markdown source offset via a sentinel
 * round trip: insert the sentinel at the selection in a throwaway transform
 * (no dispatch), serialize the resulting doc, and locate the sentinel in the
 * markdown. When the sentinel does not survive serialization, falls back to
 * the document start offset (0).
 *
 * @param input - Document, caret position, and serializer.
 * @returns Markdown offset of the caret, or 0 when the sentinel is lost.
 */
export function visualSelectionToSourceOffset(input: VisualCaretInput): number {
  const { doc, pos, serialize } = input;
  const at = Math.min(pos, doc.content.size);
  const marks = doc.resolve(at).marks();
  const tr = new Transform(doc);
  tr.insert(at, doc.type.schema.text(CARET_SENTINEL, marks));
  const markdown = serialize(tr.doc);
  const index = markdown.indexOf(CARET_SENTINEL);
  return index < 0 ? DOCUMENT_START : index;
}

/**
 * Map a markdown source offset back to a ProseMirror position via a sentinel
 * round trip: insert the sentinel at the offset in the markdown, parse it,
 * locate the sentinel in the parsed doc, then remove it. Returns the caret
 * position and the cleaned doc. When the sentinel does not survive parsing,
 * falls back to the document start position (0) with the untouched parse.
 *
 * @param input - Markdown text, caret offset, and parser.
 * @returns Caret position, sentinel-free doc, and whether the sentinel was found.
 */
export function sourceOffsetToVisualPosition(input: SourceCaretInput): SourceCaretResult {
  const { markdown, offset, parse } = input;
  const clamped = Math.max(0, Math.min(offset, markdown.length));
  const marked = markdown.slice(0, clamped) + CARET_SENTINEL + markdown.slice(clamped);
  const doc = parse(marked);
  if (!doc) return { pos: DOCUMENT_START, doc: null, found: false };

  let foundPos = -1;
  doc.descendants((node, nodePos) => {
    if (foundPos >= 0) return false;
    if (node.isText && node.text?.includes(CARET_SENTINEL)) {
      foundPos = nodePos + (node.text.indexOf(CARET_SENTINEL));
      return false;
    }
    return true;
  });
  if (foundPos < 0) return { pos: DOCUMENT_START, doc, found: false };

  const tr = new Transform(doc);
  tr.delete(foundPos, foundPos + CARET_SENTINEL.length);
  return { pos: foundPos, doc: tr.doc, found: true };
}
