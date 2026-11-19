import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';
import { TextSelection } from '@milkdown/kit/prose/state';

/** Source of a fresh Quarto list-table fenced div. */
export const LIST_TABLE_TEMPLATE = '::: {.list-table}\n\n:::';

/** Offset from the code-block content start to the blank body line. */
export const LIST_TABLE_BODY_OFFSET = '::: {.list-table}\n'.length;

/**
 * Replace the selection with a Quarto list-table template code block and
 * place the cursor on its blank body line.
 *
 * @param ctx - Milkdown context of the mounted editor.
 */
export function insertListTable(ctx: Ctx): void {
  const view = ctx.get(editorViewCtx);
  const node = codeBlockSchema.type(ctx).create(
    { language: 'quarto-div' },
    view.state.schema.text(LIST_TABLE_TEMPLATE),
  );
  const tr = view.state.tr.replaceSelectionWith(node);
  let blockStart = -1;
  tr.doc.descendants((candidate, pos) => {
    if (blockStart >= 0) return false;
    if (candidate === node) {
      blockStart = pos;
      return false;
    }
    return undefined;
  });
  if (blockStart < 0) blockStart = tr.selection.from - node.nodeSize;
  tr.setSelection(TextSelection.create(tr.doc, blockStart + 1 + LIST_TABLE_BODY_OFFSET));
  view.dispatch(tr);
  view.focus();
}
