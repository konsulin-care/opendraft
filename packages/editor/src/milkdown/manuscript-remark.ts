import { remark } from 'remark';
import type { Root } from '@milkdown/kit/transformer';
import { quarantineLiterals, reinsertLiteralBlocks, splitInlineShortcodes } from './quarto-literals.js';

/** Minimal mdast node shape used by the grouping transform. */
interface MdastNode {
  type: string;
  depth?: number;
  value?: string;
  children?: MdastNode[];
  [k: string]: unknown;
}

/** Matches a top-level `{{< include <path> >}}` line. */
const INCLUDE_RE = /^\{\{< include\s+(\S+)\s*>\}\}$/;

/** Concatenated text content of an mdast node. */
function textOf(node: MdastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

/** True when a paragraph consists solely of an include shortcode. */
function isIncludeParagraph(node: MdastNode): boolean {
  return node.type === 'paragraph' && INCLUDE_RE.test(textOf(node));
}

/**
 * Remark transform that groups flat markdown into a manuscript doc:
 * - H1 starts a new `section`; following blocks (H2+) stay inside it.
 * - Top-level include shortcode paragraphs become `include` nodes.
 * - Other top-level content (preamble) becomes verbatim `glue`.
 *
 * @returns A unified transformer that mutates the mdast root.
 */
export function groupManuscript(): (tree: MdastNode) => void {
  return (tree: MdastNode) => {
    const grouped: MdastNode[] = [];
    let current: MdastNode | null = null;

    for (const child of tree.children ?? []) {
      if (child.type === 'heading' && child.depth === 1) {
        current = { type: 'section', children: [child] };
        grouped.push(current);
        continue;
      }
      if (isIncludeParagraph(child)) {
        const match = INCLUDE_RE.exec(textOf(child));
        grouped.push({ type: 'include', path: match?.[1] ?? '' });
        current = null;
        continue;
      }
      if (child.type === 'quartoBlock') {
        if (current) {
          current.children?.push(child);
        } else {
          grouped.push(child);
        }
        continue;
      }
      if (current) {
        current.children?.push(child);
      } else {
        const raw = remark().stringify(child as unknown as Root).trimEnd();
        grouped.push({ type: 'glue', value: raw });
      }
    }

    tree.children = grouped;
  };
}

/**
 * Build the remark processor for manuscript parse/serialize pipelines.
 *
 * The processor quarantines Quarto literals before parsing, runs the
 * section grouping transform, then splits inline shortcodes.
 *
 * @returns A remark processor with the manuscript transforms.
 */
export function createManuscriptRemark() {
  const processor = remark()
    .use(() => groupManuscript())
    .use(() => (tree) => splitInlineShortcodes(tree as Root));
  const originalParse = processor.parse.bind(processor) as (doc: string) => Root;

  processor.parse = ((doc: string): Root => {
    const { markdown, cells } = quarantineLiterals(doc);
    const tree = originalParse(markdown);
    reinsertLiteralBlocks(tree, cells);
    return tree;
  }) as typeof processor.parse;

  return processor;
}