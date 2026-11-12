import type { Plugin } from 'unified';

/** Minimal mdast node shape the transformer walks and rewrites. */
interface DivAstNode {
  type: string;
  children?: DivAstNode[];
  position?: {
    start?: { line?: number; column?: number };
    end?: { line?: number; column?: number };
  };
  [key: string]: unknown;
}

/** Inclusive 0-based source-line range of one fenced div. */
interface DivRange {
  start: number;
  end: number;
}

/** Line beginning with a run of at least three colons (Pandoc div fence). */
const FENCE_LINE = /^(:{3,})(.*)$/;

/** Line opening or closing a ```/~~~ code fence (code hides div fences). */
const CODE_FENCE_LINE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Scan source lines for Pandoc fenced div ranges.
 *
 * At depth zero any `:::` line opens a div (bare or with an info
 * string); while inside, a bare `:::` line closes one level and an
 * info-carrying line opens a nested one. Lines inside ```/~~~ code
 * fences are ignored, and a fence that never closes yields no range,
 * so stray `:::` lines round-trip as ordinary paragraphs.
 *
 * @param lines - Source document split on newlines.
 * @returns Inclusive [start, end] line ranges, in document order.
 */
function findDivRanges(lines: string[]): DivRange[] {
  const ranges: DivRange[] = [];
  let inCode = false;
  let depth = 0;
  let openLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (CODE_FENCE_LINE.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const fence = FENCE_LINE.exec(line);
    if (!fence) continue;
    const info = (fence[2] ?? '').trim();
    if (depth === 0) {
      depth = 1;
      openLine = i;
    } else if (info === '') {
      depth--;
      if (depth === 0) ranges.push({ start: openLine, end: i });
    } else {
      depth++;
    }
  }
  return ranges;
}

/**
 * Build the verbatim `fencedDiv` mdast node for one source range.
 *
 * @param lines - Source document split on newlines.
 * @param range - Inclusive line range of the div.
 * @returns An mdast node carrying the raw div text.
 */
function makeDiv(lines: string[], range: DivRange): DivAstNode {
  const lastLine = lines[range.end] ?? '';
  return {
    type: 'fencedDiv',
    value: lines.slice(range.start, range.end + 1).join('\n'),
    position: {
      start: { line: range.start + 1, column: 1 },
      end: { line: range.end + 1, column: lastLine.length + 1 },
    },
  };
}

/** Shared state threaded through the range-emission helpers. */
interface EmitState {
  /** Div ranges in document order. */
  ranges: DivRange[];
  /** Whether each range has already been emitted. */
  emitted: boolean[];
  /** Output children being assembled. */
  result: DivAstNode[];
  /** Source document split on newlines. */
  lines: string[];
}

/**
 * Emit range `ri` as a `fencedDiv` node unless already emitted.
 *
 * @param state - Shared emission state (ranges, flags, result, lines).
 * @param ri - Index of the range to emit.
 */
function emitRange(state: EmitState, ri: number): void {
  if (state.emitted[ri]) return;
  state.result.push(makeDiv(state.lines, state.ranges[ri] as DivRange));
  state.emitted[ri] = true;
}

/**
 * Emit every not-yet-emitted range ending before `line`: fence-only
 * ranges with no children, or ranges children already consumed.
 *
 * @param state - Shared emission state (ranges, flags, result, lines).
 * @param ri - Index of the first range to consider.
 * @param line - 0-based source line the next child starts on.
 * @returns Index of the first range not yet flushed.
 */
function flushBefore(state: EmitState, ri: number, line: number): number {
  while (ri < state.ranges.length && (state.ranges[ri] as DivRange).end < line) {
    emitRange(state, ri);
    ri++;
  }
  return ri;
}

/**
 * Replace every child that starts inside a found range with one
 * verbatim `fencedDiv` node built from the raw source lines, so the
 * div's exact text (nested `- -` rows, blank lines, `[]{colspan=2}`
 * cells, attribute quoting) survives parse and stringify untouched.
 *
 * @param tree - Root mdast node to rewrite in place.
 * @param lines - Source document split on newlines.
 * @param ranges - Div ranges from {@link findDivRanges}.
 */
function collapseRanges(tree: DivAstNode, lines: string[], ranges: DivRange[]): void {
  const children = tree.children;
  if (!children?.length || !ranges.length) return;
  const state: EmitState = { ranges, emitted: ranges.map(() => false), result: [], lines };
  let ri = 0;
  for (const child of children) {
    const startLine = child.position?.start?.line;
    if (startLine == null) {
      state.result.push(child);
      continue;
    }
    const s = startLine - 1;
    ri = flushBefore(state, ri, s);
    if (ri < ranges.length && s >= (ranges[ri] as DivRange).start) {
      // Child starts inside the range: drop it, emit the div once.
      emitRange(state, ri);
      continue;
    }
    state.result.push(child);
  }
  // Trailing ranges no child ever reached.
  flushBefore(state, ri, Number.POSITIVE_INFINITY);
  tree.children = state.result;
}

/**
 * Remark plugin that collapses Pandoc fenced divs into a single
 * verbatim `fencedDiv` mdast node.
 *
 * Runs on the parse pass only: the transformer needs the original
 * source (file.value) to capture the div text byte-for-byte, and
 * bails out when the pass carries no string document (e.g. a
 * stringify-phase run over an already-serialized tree).
 *
 * @returns The unified attacher exposing the transformer.
 */
function createFencedDivPlugin(): () => (tree: object, file: unknown) => void {
  return () => {
    return (tree: object, file: unknown) => {
      const source =
        typeof file === 'object' && file !== null
          ? (file as { value?: unknown }).value
          : undefined;
      if (typeof source !== 'string' || !source.includes(':::')) return;
      const lines = source.split('\n');
      const ranges = findDivRanges(lines);
      if (!ranges.length) return;
      collapseRanges(tree as DivAstNode, lines, ranges);
    };
  };
}

/** Options-attached remark plugin entry for `remarkPluginsCtx`. */
export const fencedDivRemarkPlugin = {
  plugin: (() => {
    const plugin: Plugin<[Record<string, unknown>]> = createFencedDivPlugin();
    return plugin;
  })(),
  options: {},
};

/** mdast node subset read by {@link fencedDivHandler}. */
interface FencedDivNode {
  value?: unknown;
}

/**
 * remark-stringify handler for `fencedDiv` nodes: emits the captured
 * source text verbatim, bypassing every escape and join rule that
 * otherwise mangles list-table rows or bracketed attributes.
 *
 * @param node - The `fencedDiv` mdast node.
 * @param _parent - Parent node (unused).
 * @param _state - Serializer state (unused).
 * @returns The div's raw source text.
 */
export function fencedDivHandler(node: FencedDivNode, _parent: unknown, _state: unknown): string {
  return typeof node.value === 'string' ? node.value : '';
}
