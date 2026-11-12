import type { Plugin } from 'unified';
import { ViewPlugin, Decoration, DecorationSet, EditorView } from '@codemirror/view';

/**
 * Remark plugin that preserves Quarto-style code fence headers.
 *
 * remark splits a fence info string at the first space, so
 * ` ```{r label, echo=FALSE} ` parses as lang=`{r` +
 * meta=`label, echo=FALSE}`. Milkdown's code_block schema serializes
 * only `node.lang`, so this plugin rejoins the split parts into
 * `lang` (and clears `meta`) to keep the original header intact
 * across parse/stringify round trips.
 *
 * Standard fences like ` ```r ` are left unchanged.
 */
export const quartoRemarkPlugin = {
  plugin: (() => {
    const plugin: Plugin<[Record<string, unknown>]> = () => {
      return (tree: object) => {
        visitCodeBlocks(tree, (node: Record<string, unknown>) => {
          const lang = node.lang as string | undefined;
          // Only Quarto-style fences carry brace-wrapped info; leave
          // standard fences (```r) untouched.
          if (!lang || !lang.startsWith('{')) return;
          const meta = node.meta as string | undefined;
          node.lang = meta ? `${lang} ${meta}` : lang;
          node.meta = null;
        });
      };
    };
    return plugin;
  })(),
  options: {},
};

// --- remark-stringify code handler ---

/** Subset of an mdast code node used by {@link quartoCodeHandler}. */
interface CodeNode {
  lang?: string | null;
  meta?: string | null;
  value?: string;
}

/** Subset of the mdast-util-to-markdown state used by {@link quartoCodeHandler}. */
interface StringifyState {
  options: { fence?: string | null; fences?: boolean | null };
  indentLines: (value: string, map: (line: string, index: number, blank: boolean) => string) => string;
}

/**
 * remark-stringify `code` handler that writes fence info verbatim.
 *
 * The stock handler runs `state.safe()` on `node.lang` inside the
 * `codeFencedLang` construct, whose unsafe rules encode spaces as
 * `&#x20;` — mangling Quarto headers such as `{r label, echo=FALSE}`
 * that {@link quartoRemarkPlugin} merges into `lang`. This handler
 * replicates the default fence logic (indented fallback, backtick
 * streak sizing) but emits `lang`/`meta` raw, escaping only backtick
 * characters, and never enters the `codeFencedLang*` constructs.
 *
 * @param node - mdast code node being serialized.
 * @param _parent - Parent node (unused).
 * @param state - Serializer state (fence options and indentLines).
 * @returns The serialized fenced or indented code block.
 */
export function quartoCodeHandler(node: CodeNode, _parent: unknown, state: StringifyState): string {
  const marker = state.options.fence === '~' ? '~' : '`';
  const raw = node.value ?? '';
  // Indented fallback mirrors mdast-util-to-markdown's formatCodeAsIndented.
  if (
    state.options.fences === false &&
    raw &&
    !node.lang &&
    /[^\n\r ]/.test(raw) &&
    !/^[\t ]*(?:[\n\r]|$)|(?:^|[\n\r])[\t ]*$/.test(raw)
  ) {
    return state.indentLines(raw, (line, _index, blank) => (blank ? '' : '    ') + line);
  }
  const sequence = marker.repeat(Math.max(longestStreak(raw, marker) + 1, 3));
  let value = sequence;
  if (node.lang) value += escapeBackticks(node.lang);
  if (node.lang && node.meta) value += ' ' + escapeBackticks(node.meta);
  value += '\n';
  if (raw) value += raw + '\n';
  value += sequence;
  return value;
}

/** Escape backtick characters so they cannot close the fence. */
function escapeBackticks(value: string): string {
  return value.replace(/`/g, '&#x60;');
}

/** Longest run of `sub` in `value` (mirrors the longest-streak utility). */
function longestStreak(value: string, sub: string): number {
  let index = value.indexOf(sub);
  let expected = index;
  let count = 0;
  let max = 0;
  while (index !== -1) {
    count = index === expected ? count + 1 : 1;
    if (count > max) max = count;
    expected = index + sub.length;
    index = value.indexOf(sub, expected);
  }
  return max;
}

/**
 * Remark plugin that tags inline Quarto code: `` `{r} radius` ``.
 *
 * Attaches `data.quartoLang = 'r'` as metadata but leaves `value`
 * verbatim: Milkdown's inlineCode mark is attrs-less and stores the
 * text as-is, so stripping the `{lang} ` prefix would be lost — and
 * unrepresentable — on parse/stringify round trips.
 */
export const quartoInlineCodePlugin = {
  plugin: (() => {
    const plugin: Plugin<[Record<string, unknown>]> = () => {
      return (tree: object) => {
        visitInlineCode(tree, (node: Record<string, unknown>, _parent: Record<string, unknown>) => {
          const value = node.value as string | undefined;
          if (!value) return;

          // Check if this looks like `{lang} expr`
          const match = value.match(/^\{(\w+)\}\s+(.+)$/);
          if (!match) return;

          const [, lang] = match;

          // Keep `value` verbatim (the attrs-less inlineCode mark
          // round-trips text as-is); record the language as metadata.
          node.type = 'inlineCode';
          node.data = node.data || {};
          const data = node.data as Record<string, unknown>;
          data.quartoLang = lang;
        });
      };
    };
    return plugin;
  })(),
  options: {},
};

/**
 * Regex to match Quarto chunk option lines: `#|` with optional leading whitespace.
 */
const CHUNK_OPTION_REGEX = /^\s*#\|/;

/**
 * Decoration for chunk option lines.
 */
const chunkOptionDeco = Decoration.line({
  attributes: { class: 'quarto-chunk-option' },
});

/**
 * CodeMirror extension that decorates Quarto chunk option lines.
 *
 * Lines matching `#|` (with optional leading whitespace) get the
 * CSS class `quarto-chunk-option` for styling.
 */
export const quartoChunkOptionPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: { view: EditorView; docChanged: boolean }) {
      if (update.docChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const decorations: Array<{ from: number; to: number; deco: typeof chunkOptionDeco }> = [];

      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        const lines = text.split('\n');
        let lineStart = from;

        for (const line of lines) {
          if (CHUNK_OPTION_REGEX.test(line)) {
            decorations.push({
              from: lineStart,
              to: lineStart + line.length,
              deco: chunkOptionDeco,
            });
          }
          lineStart += line.length + 1; // +1 for the newline
        }
      }

      return Decoration.set(decorations.map((d) => d.deco.range(d.from, d.to)));
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

// --- AST visitor helpers ---

interface AstNode {
  type: string;
  children?: AstNode[];
  [key: string]: unknown;
}

/** Visit all code blocks in the AST. */
function visitCodeBlocks(
  tree: object,
  callback: (node: Record<string, unknown>) => void,
): void {
  const node = tree as AstNode;
  if (node.type === 'code') {
    callback(node as unknown as Record<string, unknown>);
  }
  if (node.children) {
    for (const child of node.children) {
      visitCodeBlocks(child, callback);
    }
  }
}

/** Visit inline code nodes, providing access to the parent. */
function visitInlineCode(
  tree: object,
  callback: (node: Record<string, unknown>, parent: Record<string, unknown>) => void,
): void {
  const node = tree as AstNode;
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.type === 'inlineCode') {
        callback(
          child as unknown as Record<string, unknown>,
          node as unknown as Record<string, unknown>,
        );
      } else {
        visitInlineCode(child, callback);
      }
    }
  }
}
