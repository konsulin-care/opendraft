import { Decoration, DecorationSet, ViewPlugin, WidgetType } from '@codemirror/view';
import type { EditorView, ViewUpdate } from '@codemirror/view';

/** Placeholder text shown on the blank body of an empty `.list-table` div. */
export const LIST_TABLE_PLACEHOLDER = `Insert your table caption here...

- - Column 1
  - Column 2

- - Cell 1
  - Cell 2`;

/** Opening fence line carrying a `.list-table` class. */
const OPENING_FENCE = /^:{3,}\s*\{[^}]*\.list-table\b[^}]*\}\s*$/;

/** Blank line (whitespace only). */
const BLANK_LINE = /^\s*$/;

/** Closing fence line (colons only). */
const CLOSING_FENCE = /^:{3,}\s*$/;

/**
 * Visual-only widget rendering the list-table placeholder text.
 *
 * The text is exposed through a `span` with `aria-hidden`, so assistive
 * technology and the document itself never see it; it only paints the
 * hint inside the editor.
 */
class PlaceholderWidget extends WidgetType {
  /**
   * Build the placeholder DOM node.
   *
   * @returns A span holding the placeholder text.
   */
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-placeholder cm-list-table-placeholder';
    span.setAttribute('aria-hidden', 'true');
    span.style.whiteSpace = 'pre';
    span.style.pointerEvents = 'none';
    span.textContent = LIST_TABLE_PLACEHOLDER;
    return span;
  }

  /**
   * Placeholder widgets are interchangeable.
   *
   * @returns Always true.
   */
  eq(): boolean {
    return true;
  }

  /**
   * Never intercept editor events such as clicks or typing.
   *
   * @returns Always true.
   */
  ignoreEvent(): boolean {
    return true;
  }
}

/** Shared decoration placing the placeholder at the start of a blank line. */
const PLACEHOLDER_DECORATION = Decoration.widget({
  widget: new PlaceholderWidget(),
  side: 1,
});

/**
 * Locate the blank body line of every empty `.list-table` div.
 *
 * A match is an opening `.list-table` fence immediately followed by one
 * or more whitespace-only lines and then a bare closing fence. Content
 * typed into the body means the closing fence is no longer preceded only
 * by blank lines, so the placeholder disappears.
 *
 * @param doc - The editor document text.
 * @returns Document offsets at the start of each qualifying blank line.
 */
function findPlaceholderOffsets(doc: string): number[] {
  const lines = doc.split('\n');
  const offsets: number[] = [];
  let lineStart = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string;
    if (OPENING_FENCE.test(line)) {
      let body = index + 1;
      if (body < lines.length && BLANK_LINE.test(lines[body] as string)) {
        const firstBlankOffset = lineStart + line.length + 1;
        while (body < lines.length && BLANK_LINE.test(lines[body] as string)) {
          body += 1;
        }
        if (body < lines.length && CLOSING_FENCE.test(lines[body] as string)) {
          offsets.push(firstBlankOffset);
        }
      }
    }
    lineStart += line.length + 1;
  }

  return offsets;
}

/**
 * Recompute the placeholder decorations for the whole document.
 *
 * @param view - The editor view to decorate.
 * @returns The decoration set containing one widget per empty list-table.
 */
function buildDecorations(view: EditorView): DecorationSet {
  return Decoration.set(
    findPlaceholderOffsets(view.state.doc.toString()).map((offset) =>
      PLACEHOLDER_DECORATION.range(offset),
    ),
  );
}

/**
 * CodeMirror extension that shows a placeholder on the blank body line of
 * every empty `.list-table` fenced div as a visual-only decoration.
 */
export const listTablePlaceholder = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);
