/** One open fenced div tracked while scanning source lines. */
interface OpenDiv {
  /** 0-based source line the opening fence sits on. */
  start: number;
  /** Whether the opening fence carries the `.list-table` class. */
  isListTable: boolean;
}

/** Line beginning with a run of at least three colons (Pandoc div fence). */
const FENCE_LINE = /^(:{3,})(.*)$/;

/** Line opening or closing a ```/~~~ code fence (code hides div fences). */
const CODE_FENCE_LINE = /^\s{0,3}(`{3,}|~{3,})/;

/** `.list-table` class token inside an opening fence attribute block. */
const LIST_TABLE_CLASS = /(?:^|[\s{])\.list-table(?=[\s}]|$)/;

/** Inclusive 0-based source-line range of one qualifying div. */
interface DivRange {
  start: number;
  end: number;
}

/**
 * Scan source lines for fenced divs carrying the `.list-table` class.
 *
 * Mirrors the fence rules of `fenced-div.ts`: an info-carrying `:::`
 * line opens a div, a bare `:::` closes the innermost open div, and
 * lines inside ```/~~~ code fences are ignored. Unclosed divs yield
 * nothing.
 *
 * @param lines - Source document split on newlines.
 * @returns Qualifying line ranges, sorted in document order.
 */
function findListTableRanges(lines: string[]): DivRange[] {
  const ranges: DivRange[] = [];
  const stack: OpenDiv[] = [];
  let inCode = false;
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
    if (stack.length > 0 && info === '') {
      const open = stack.pop() as OpenDiv;
      if (open.isListTable) ranges.push({ start: open.start, end: i });
      continue;
    }
    stack.push({ start: i, isListTable: LIST_TABLE_CLASS.test(info) });
  }
  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}

/**
 * Return the raw source of every div whose opening fence carries the
 * `.list-table` class, at any nesting depth, in document order.
 *
 * The returned text includes both fence lines and is joined with
 * newlines, matching the source of the div block exactly.
 *
 * @param sourceText - Raw text of a document or div block.
 * @returns Raw source of each matching div, in document order.
 */
export function findListTables(sourceText: string): string[] {
  const lines = sourceText.split('\n');
  return findListTableRanges(lines).map((range) =>
    lines.slice(range.start, range.end + 1).join('\n'),
  );
}
