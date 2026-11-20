/**
 * Split markdown into prose, fenced code and inline code segments.
 *
 * Fence detection mirrors the rules used by `extractCitekeys`: an opening
 * fence is `^ {0,3}(`{3,}|~{3,})` and is closed by the same character with a
 * run length at least as long as the opening and only whitespace after it.
 * Inline spans are equal-run backtick spans inside prose.
 */

/** A contiguous piece of markdown, classified by how it is interpreted. */
export interface CodeSegment {
  /** The exact source text of the segment, including any trailing newline. */
  text: string;
  /** Whether the segment is prose, a fenced block or an inline span. */
  kind: 'prose' | 'fence' | 'inline';
  /** The trimmed info string after the opening fence, for fence segments. */
  info?: string;
}

/** Opening fence: up to three spaces, then at least three backticks or tildes. */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

/** Equal-run backtick span, closing run not followed by another backtick. */
const INLINE_CODE = /(`+)[^`]+?\1(?!`)/g;

/** Append inline and prose segments for one prose line. */
function pushProseLine(
  segments: CodeSegment[],
  line: string,
  trailingNewline: boolean,
): void {
  if (line === '') {
    segments.push({ text: trailingNewline ? '\n' : '', kind: 'prose' });
    return;
  }

  const start = segments.length;
  let last = 0;
  INLINE_CODE.lastIndex = 0;
  for (let match = INLINE_CODE.exec(line); match !== null; match = INLINE_CODE.exec(line)) {
    if (match.index > last) {
      segments.push({ text: line.slice(last, match.index), kind: 'prose' });
    }
    segments.push({ text: match[0], kind: 'inline' });
    last = match.index + match[0].length;
  }
  if (last < line.length) {
    segments.push({ text: line.slice(last), kind: 'prose' });
  } else if (segments.length === start) {
    segments.push({ text: '', kind: 'prose' });
  }

  if (trailingNewline) {
    segments[segments.length - 1].text += '\n';
  }
}

/**
 * Split markdown into prose, fenced and inline code segments.
 *
 * The returned segments concatenate back to the exact input text: every
 * character appears once, in order. Fence segments span the opening line
 * through the closing line (or the end of the input for an unclosed fence)
 * and carry the trimmed info string that follows the opening fence.
 *
 * @param markdown - Raw markdown text.
 * @returns The ordered, exhaustive list of classified segments.
 */
export function splitCodeSegments(markdown: string): CodeSegment[] {
  const lines = markdown.split('\n');
  const segments: CodeSegment[] = [];
  let fence: { char: string; length: number } | null = null;
  let fenceStart = 0;
  let fenceInfo = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = FENCE_OPEN.exec(line);

    if (fence === null) {
      if (match !== null) {
        fence = { char: match[1][0], length: match[1].length };
        fenceStart = index;
        fenceInfo = line.slice(match[0].length).trim();
        continue;
      }
      pushProseLine(segments, line, index < lines.length - 1);
      continue;
    }

    const closing = match !== null
      && match[1][0] === fence.char
      && match[1].length >= fence.length
      && /^[ \t]*$/.test(line.slice(match[0].length));
    if (!closing) continue;

    const hasNewline = index < lines.length - 1;
    const text = lines.slice(fenceStart, index + 1).join('\n') + (hasNewline ? '\n' : '');
    segments.push({ text, kind: 'fence', info: fenceInfo });
    fence = null;
  }

  if (fence !== null) {
    const text = lines.slice(fenceStart).join('\n');
    segments.push({ text, kind: 'fence', info: fenceInfo });
  }

  return segments;
}

/**
 * Blank out fenced and inline code while preserving the line structure.
 *
 * Every line of a fenced block, including the fence lines themselves, becomes
 * an empty line, so the line count is unchanged. Each inline code span becomes
 * a single space so surrounding words are not glued together.
 *
 * @param markdown - Raw markdown text.
 * @returns The text with fenced and inline code removed.
 */
export function blankCode(markdown: string): string {
  return splitCodeSegments(markdown)
    .map((segment) => {
      if (segment.kind === 'fence') {
        return segment.text.split('\n').map(() => '').join('\n');
      }
      if (segment.kind === 'inline') return ' ';
      return segment.text;
    })
    .join('');
}
