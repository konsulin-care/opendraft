import type { Plugin } from 'unified';
import { ViewPlugin, Decoration, DecorationSet, EditorView } from '@codemirror/view';

/**
 * Match Quarto-style code fence language:
 * - `{r}` → 'r'
 * - `{python}` → 'python'
 * - `{r init}` → 'r' (with label)
 * - `{{python}}` → 'python' (double braces)
 *
 * Note: remark splits `{python my-label}` into lang=`{python` and meta=`my-label}`.
 * So we need to match both `{lang}` and `{lang` patterns.
 */
const QUARTO_LANG_PATTERN = /^\{(\w+)(?:\s+\w+)?\}$/;
const QUARTO_LANG_NO_BRACE = /^\{(\w+)$/;
const QUARTO_DOUBLE_BRACE_PATTERN = /^\{\{(\w+)\}\}$/;

/**
 * Remark plugin that normalizes Quarto-style code fences.
 *
 * Transforms:
 * - ` ```{r} ` → ` ```r `
 * - ` ```{python my-label} ` → ` ```python `
 * - ` ```{{julia}} ` → ` ```julia `
 *
 * Standard fences like ` ```r ` are left unchanged.
 */
export const quartoRemarkPlugin = {
  plugin: (() => {
    const plugin: Plugin<[], object> = () => {
      return (tree: object) => {
        visitCodeBlocks(tree, (node: Record<string, unknown>) => {
          const lang = node.lang as string | undefined;
          if (!lang) return;

          // Try single-brace pattern: {r}, {python init}, etc.
          // Note: remark may split `{python my-label}` into lang=`{python` and meta=`my-label}`
          const singleMatch = lang.match(QUARTO_LANG_PATTERN);
          if (singleMatch) {
            node.data = node.data || {};
            const data = node.data as Record<string, unknown>;
            data.hProperties = data.hProperties || {};
            const hProps = data.hProperties as Record<string, unknown>;
            hProps.quartoLang = lang;
            node.lang = singleMatch[1];
            return;
          }

          // Handle case where remark split the lang (e.g., `{python` from `{python my-label}`)
          const noBraceMatch = lang.match(QUARTO_LANG_NO_BRACE);
          if (noBraceMatch) {
            node.data = node.data || {};
            const data = node.data as Record<string, unknown>;
            data.hProperties = data.hProperties || {};
            const hProps = data.hProperties as Record<string, unknown>;
            hProps.quartoLang = lang + (node.meta ? ' ' + node.meta : '');
            node.lang = noBraceMatch[1];
            node.meta = null;
            return;
          }

          // Try double-brace pattern: {{python}}, {{r}}, etc.
          const doubleMatch = lang.match(QUARTO_DOUBLE_BRACE_PATTERN);
          if (doubleMatch) {
            node.data = node.data || {};
            const data = node.data as Record<string, unknown>;
            data.hProperties = data.hProperties || {};
            const hProps = data.hProperties as Record<string, unknown>;
            hProps.quartoLang = lang;
            node.lang = doubleMatch[1];
          }
        });
      };
    };
    return plugin;
  })(),
  options: {},
};

/**
 * Remark plugin that handles inline Quarto code: `{r} expr`.
 *
 * Transforms `` `{r} radius` `` into an inlineCode node with
 * `data.hProperties.quartoLang = 'r'` and `value = 'radius'`.
 */
export const quartoInlineCodePlugin = {
  plugin: (() => {
    const plugin: Plugin<[], object> = () => {
      return (tree: object) => {
        visitInlineCode(tree, (node: Record<string, unknown>, _parent: Record<string, unknown>) => {
          const value = node.value as string | undefined;
          if (!value) return;

          // Check if this looks like `{lang} expr`
          const match = value.match(/^\{(\w+)\}\s+(.+)$/);
          if (!match) return;

          const [, lang, expr] = match;

          // Transform this node into a standard inlineCode with metadata
          node.type = 'inlineCode';
          node.value = expr;
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
