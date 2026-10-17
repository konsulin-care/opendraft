import { useMemo } from 'react';
import type { Ctx } from '@milkdown/kit/ctx';
import type { Editor } from '@milkdown/kit/core';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { MarkType, NodeType } from '@milkdown/kit/prose/model';
import {
  addBlockTypeCommand,
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  emphasisSchema,
  headingSchema,
  hrSchema,
  inlineCodeSchema,
  orderedListSchema,
  paragraphSchema,
  setBlockTypeCommand,
  strongSchema,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockTypeCommand,
  linkSchema,
} from '@milkdown/kit/preset/commonmark';
import {
  createTable,
  strikethroughSchema,
  toggleStrikethroughCommand,
} from '@milkdown/kit/preset/gfm';
import { undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import { toggleLinkCommand } from '@milkdown/kit/component/link-tooltip';
import { imageBlockSchema } from '@milkdown/kit/component/image-block';
import { useInstance } from '@milkdown/react';
import { INACTIVE_STATE, type ActiveState, type BlockLevel, type EditorCommands } from './types';

/**
 * True when the selection carries the given mark. A collapsed cursor reads
 * stored marks or the marks at the cursor; a range checks the whole range.
 *
 * @param state - Editor state to inspect.
 * @param type - Mark type to look for.
 * @returns Whether the mark is active at the selection.
 */
function markActive(state: EditorState, type: MarkType): boolean {
  const { from, to, empty, $from } = state.selection;
  if (empty) {
    const marks = state.storedMarks ?? $from.marks();
    return type.isInSet(marks) !== undefined;
  }
  return state.doc.rangeHasMark(from, to, type);
}

/**
 * True when any ancestor of the selection is of the given node type.
 *
 * @param state - Editor state to inspect.
 * @param type - Node type to look for.
 * @returns Whether the selection sits inside a node of that type.
 */
function insideNode(state: EditorState, type: NodeType): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type === type) return true;
  }
  return false;
}

/**
 * Read the formatting state at the selection from a Milkdown context.
 *
 * @param ctx - Milkdown context.
 * @returns The active formatting snapshot.
 */
function readActiveState(ctx: Ctx): ActiveState {
  const state = ctx.get(editorViewCtx).state;
  const headingType = headingSchema.type(ctx);
  const { $from } = state.selection;
  const level = $from.parent.type === headingType ? Number($from.parent.attrs.level) : 0;
  return {
    bold: markActive(state, strongSchema.type(ctx)),
    italic: markActive(state, emphasisSchema.type(ctx)),
    strike: markActive(state, strikethroughSchema.type(ctx)),
    inlineCode: markActive(state, inlineCodeSchema.type(ctx)),
    link: markActive(state, linkSchema.type(ctx)),
    heading: (level >= 1 && level <= 3 ? level : 0) as BlockLevel,
    bulletList: insideNode(state, bulletListSchema.type(ctx)),
    orderedList: insideNode(state, orderedListSchema.type(ctx)),
    blockquote: insideNode(state, blockquoteSchema.type(ctx)),
  };
}

/**
 * Insert plain text at the selection through a transaction.
 *
 * @param ctx - Milkdown context.
 * @param text - Text to insert.
 */
function insertAtSelection(ctx: Ctx, text: string): void {
  const view = ctx.get(editorViewCtx);
  view.dispatch(view.state.tr.insertText(text));
}

/** Runs a callback against the editor context; a no-op while not ready. */
type Run = (fn: (ctx: Ctx) => void) => void;

/**
 * Inline formatting, undo/redo, and text insertion commands.
 *
 * @param run - Runs a callback against the editor context.
 * @returns The inline subset of {@link EditorCommands}.
 */
function inlineCommands(run: Run): Omit<EditorCommands, 'canFormat' | 'activeState' | keyof BlockCommands> {
  return {
    undo: () => run((ctx) => ctx.get(commandsCtx).call(undoCommand.key)),
    redo: () => run((ctx) => ctx.get(commandsCtx).call(redoCommand.key)),
    toggleBold: () => run((ctx) => ctx.get(commandsCtx).call(toggleStrongCommand.key)),
    toggleItalic: () => run((ctx) => ctx.get(commandsCtx).call(toggleEmphasisCommand.key)),
    toggleStrike: () => run((ctx) => ctx.get(commandsCtx).call(toggleStrikethroughCommand.key)),
    toggleInlineCode: () => run((ctx) => ctx.get(commandsCtx).call(toggleInlineCodeCommand.key)),
    toggleLink: () => run((ctx) => ctx.get(commandsCtx).call(toggleLinkCommand.key)),
    insertCitation: () => run((ctx) => insertAtSelection(ctx, '@')),
    inlineMath: () => run((ctx) => insertAtSelection(ctx, '$$')),
  };
}

/** Block-level command subset of {@link EditorCommands}. */
type BlockCommands = Pick<
  EditorCommands,
  'setHeading' | 'bulletList' | 'orderedList' | 'taskList' | 'blockquote' | 'codeBlock' | 'table' | 'hr' | 'image'
>;

/**
 * Block-level commands: headings, lists, quotes, code, table, rule, image.
 *
 * @param run - Runs a callback against the editor context.
 * @returns The block subset of {@link EditorCommands}.
 */
function blockCommands(run: Run): BlockCommands {
  return {
    setHeading: (level) =>
      run((ctx) => {
        if (level === 0) {
          ctx.get(commandsCtx).call(setBlockTypeCommand.key, { nodeType: paragraphSchema.type(ctx) });
          return;
        }
        ctx.get(commandsCtx).call(setBlockTypeCommand.key, {
          nodeType: headingSchema.type(ctx),
          attrs: { level },
        });
      }),
    bulletList: () =>
      run((ctx) =>
        ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, { nodeType: bulletListSchema.type(ctx) }),
      ),
    orderedList: () =>
      run((ctx) =>
        ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, { nodeType: orderedListSchema.type(ctx) }),
      ),
    taskList: () =>
      run((ctx) => {
        ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, { nodeType: bulletListSchema.type(ctx) });
        insertAtSelection(ctx, '[ ] ');
      }),
    blockquote: () =>
      run((ctx) =>
        ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, { nodeType: blockquoteSchema.type(ctx) }),
      ),
    codeBlock: () =>
      run((ctx) =>
        ctx.get(commandsCtx).call(setBlockTypeCommand.key, { nodeType: codeBlockSchema.type(ctx) }),
      ),
    table: () =>
      run((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.replaceSelectionWith(createTable(ctx, 3, 3)));
      }),
    hr: () =>
      run((ctx) => ctx.get(commandsCtx).call(addBlockTypeCommand.key, { nodeType: hrSchema.type(ctx) })),
    image: () =>
      run((ctx) =>
        ctx.get(commandsCtx).call(addBlockTypeCommand.key, { nodeType: imageBlockSchema.type(ctx) }),
      ),
  };
}

/**
 * Build the Milkdown implementation of {@link EditorCommands}. Every action
 * calls the same command keys Crepe's TopBar uses, so keyboard shortcuts,
 * the slash menu, and the toolbar produce identical edits. Actions are no-ops
 * until the editor is ready.
 *
 * @param getEditor - Returns the mounted editor, or undefined while loading.
 * @returns A command set bound to the editor.
 */
export function createMilkdownCommands(getEditor: () => Editor | undefined): EditorCommands {
  const run: Run = (fn) => {
    const editor = getEditor();
    if (editor) editor.action(fn);
  };
  return {
    canFormat: true,
    ...inlineCommands(run),
    ...blockCommands(run),
    activeState: () => {
      const editor = getEditor();
      return editor ? editor.action(readActiveState) : INACTIVE_STATE;
    },
  };
}

/**
 * React hook returning the Milkdown {@link EditorCommands} for the editor
 * mounted in the nearest MilkdownProvider. Tolerates a not-yet-ready editor.
 *
 * @returns A memoised command set.
 */
export function useMilkdownCommands(): EditorCommands {
  const [, getEditor] = useInstance();
  return useMemo(() => createMilkdownCommands(() => getEditor()), [getEditor]);
}
