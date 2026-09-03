import type { Root } from '@milkdown/kit/transformer';

/** Minimal mdast node shape used by the literal transforms. */
interface MdastNode {
  type: string;
  depth?: number;
  lang?: string | null;
  value?: string;
  children?: MdastNode[];
  [k: string]: unknown;
}

/** Opens a Quarto fenced div (`:::` / `:::{.class}`). */
const DIV_OPEN_RE = /^:::/;

/** A standalone non-include block shortcode line, e.g. `{{< embed x >}}`. */
const BLOCK_SHORTCODE_RE = /^\{\{< (?!include\b)[^>]+ >\}\}$/;

/** Any shortcode occurrence for inline splitting. */
const INLINE_SHORTCODE_RE = /\{\{<[^>]+>\}\}/g;

/** Sentinel fence language prefix carrying the cell index. */
const SENTINEL_PREFIX = 'quarto-literal-';

/** Longest run of backticks in a string (minimum 1). */
function maxBacktickRun(text: string): number {
  let max = 0;
  let run = 0;
  for (const ch of text) {
    if (ch === '`') {
      run += 1;
      max = Math.max(max, run);
    } else {
      run = 0;
    }
  }
  return Math.max(max, 1);
}

/**
 * Extract Quarto literal constructs (fenced divs, block shortcodes) from
 * raw markdown and quarantine them inside sentinel fenced code blocks so
 * the mdast parser cannot mangle them.
 *
 * @param markdown - Raw markdown text.
 * @returns Processed markdown plus the verbatim extracted cells.
 */
export function quarantineLiterals(markdown: string): { markdown: string; cells: string[] } {
  const lines = markdown.split('\n');
  const out: string[] = [];
  const cells: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (DIV_OPEN_RE.test(line)) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== ':::') j += 1;
      const cell = lines.slice(i, Math.min(j + 1, lines.length)).join('\n');
      pushSentinel(out, cells, cell);
      i = j + 1;
      continue;
    }

    if (BLOCK_SHORTCODE_RE.test(line)) {
      pushSentinel(out, cells, line);
      i += 1;
      continue;
    }

    out.push(line);
    i += 1;
  }

  return { markdown: out.join('\n'), cells };
}

/** Wrap one extracted cell in a sentinel fenced code block. */
function pushSentinel(out: string[], cells: string[], cell: string): void {
  const index = cells.length;
  const fence = '`'.repeat(Math.max(4, maxBacktickRun(cell) + 1));
  out.push(`${fence}${SENTINEL_PREFIX}${index}`);
  out.push(...cell.split('\n'));
  out.push(fence);
  cells.push(cell);
}

/**
 * Replace sentinel code nodes (lang `quarto-literal-<n>`) with verbatim
 * quartoBlock mdast nodes.
 *
 * @param tree - The mdast root after quarantine parsing.
 * @param cells - Extracted literal cells indexed by sentinel number.
 */
export function reinsertLiteralBlocks(tree: Root, cells: string[]): void {
  const walk = (node: MdastNode): void => {
    if (!node.children) return;
    node.children = node.children.flatMap((child) => {
      const sentinel = /^quarto-literal-(\d+)$/.exec(String(child.lang ?? ''));
      if (child.type === 'code' && sentinel) {
        const index = Number(sentinel[1]);
        const value = cells[index] ?? child.value ?? '';
        return [{ type: 'quartoBlock', value }];
      }
      walk(child);
      return [child];
    });
  };
  walk(tree as MdastNode);
}

/**
 * Split inline shortcodes inside text nodes into quartoInline literals.
 *
 * @param tree - The mdast root to walk in place.
 */
export function splitInlineShortcodes(tree: Root): void {
  const walk = (node: MdastNode): void => {
    if (!node.children) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === 'text' && typeof child.value === 'string') {
        return splitText(child.value);
      }
      walk(child);
      return [child];
    });
  };
  walk(tree as MdastNode);
}

/** Split a text value into text / quartoInline nodes. */
function splitText(value: string): MdastNode[] {
  const nodes: MdastNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(INLINE_SHORTCODE_RE)) {
    const before = value.slice(cursor, match.index);
    if (before.length > 0) nodes.push({ type: 'text', value: before });
    nodes.push({ type: 'quartoInline', value: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) nodes.push({ type: 'text', value: value.slice(cursor) });
  return nodes.length > 0 ? nodes : [];
}