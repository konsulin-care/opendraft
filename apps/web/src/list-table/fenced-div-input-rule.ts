import { InputRule } from '@milkdown/kit/prose/inputrules';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';
import { $inputRule } from '@milkdown/kit/utils';

/** Opening fence plus optional attributes, then the typed whitespace. */
const FENCE_INPUT = /^(:{3,})(\{[^}]*\})?\s$/;

/** Closing fence line appended to every inserted div. */
const CLOSING_FENCE = ':::';

/**
 * The raw fenced-div source to insert and the cursor offset inside it.
 *
 * A bare fence keeps a trailing space on the opening line (the user
 * types attributes next); an attributed fence puts the cursor on the
 * blank body line instead.
 *
 * @param fence - Colon run that opened the div.
 * @param attrs - Optional `{...}` attribute block.
 * @returns Source text and the cursor offset from the block content start.
 */
function buildDivSource(
  fence: string,
  attrs: string | undefined,
): { text: string; cursor: number } {
  if (attrs) {
    const opening = `${fence}${attrs}`;
    return { text: `${opening}\n\n${CLOSING_FENCE}`, cursor: opening.length + 1 };
  }
  const opening = `${fence} `;
  return { text: `${opening}\n\n${CLOSING_FENCE}`, cursor: opening.length };
}

/** Inputs for {@link replaceParagraph}. */
interface ReplaceParagraphInput {
  ctx: Parameters<typeof codeBlockSchema.type>[0];
  state: EditorState;
  text: string;
  cursor: number;
  from: number;
  to: number;
}

/**
 * Replace the whole paragraph with the div source code block.
 *
 * @param input - Context, editor state, source text, cursor offset and range.
 * @returns The transaction replacing the paragraph, selection inside it.
 */
function replaceParagraph(input: ReplaceParagraphInput): Transaction {
  const { ctx, state, text, cursor, from, to } = input;
  const block = codeBlockSchema.type(ctx).create(
    { language: 'quarto-div' },
    state.schema.text(text),
  );
  const tr = state.tr.replaceWith(from, to, block);
  tr.setSelection(TextSelection.create(tr.doc, from + 1 + cursor));
  return tr;
}

/**
 * Input rule turning a typed `:::` fence into an editable fenced-div
 * code block. Fires only when the paragraph text is exactly the fence
 * (plus an optional attribute block) and the typed space.
 */
export const fencedDivInputRule = $inputRule(
  (ctx) =>
    new InputRule(FENCE_INPUT, (state, match, start, end) => {
      const $start = state.doc.resolve(start);
      if ($start.parent.type.name !== 'paragraph') return null;
      if (start !== $start.start() || end !== $start.end()) return null;
      const fence = match[1] ?? '';
      const { text, cursor } = buildDivSource(fence, match[2]);
      return replaceParagraph({
        ctx,
        state,
        text,
        cursor,
        from: $start.before(),
        to: $start.after(),
      });
    }),
);
