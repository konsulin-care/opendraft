import { remark } from 'remark';
import type { Root } from '@milkdown/kit/transformer';

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
 * @returns A remark processor with the manuscript grouping transform.
 */
export function createManuscriptRemark() {
  return remark().use(() => groupManuscript());
}