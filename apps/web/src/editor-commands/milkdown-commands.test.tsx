import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor, rootCtx, defaultValueCtx, commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, setBlockTypeCommand, wrapInBlockTypeCommand, addBlockTypeCommand } from '@milkdown/kit/preset/commonmark';
import { gfm, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { history, undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import { toggleLinkCommand, linkTooltipPlugin } from '@milkdown/kit/component/link-tooltip';
import { getMarkdown } from '@milkdown/kit/utils';
import { TextSelection } from '@milkdown/kit/prose/state';
import { createMilkdownCommands } from './milkdown-commands';
import type { EditorCommands } from './types';

// @vitest-environment jsdom

let editor: Editor | undefined;
let commands: EditorCommands;

/**
 * Mount a Milkdown editor with the given markdown and bind the command set.
 *
 * @param markdown - Initial markdown content.
 */
async function mount(markdown: string): Promise<void> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(linkTooltipPlugin)
    .create();
  commands = createMilkdownCommands(() => editor);
}

/**
 * Select a text range inside the first paragraph.
 *
 * @param from - Start position in the document.
 * @param to - End position in the document.
 */
function select(from: number, to: number): void {
  editor!.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
  });
}

/**
 * Current markdown of the editor.
 *
 * @returns The serialized markdown.
 */
function markdown(): string {
  return editor!.action(getMarkdown());
}

beforeEach(async () => {
  await mount('text');
});

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  document.body.innerHTML = '';
});

describe('Milkdown inline formatting commands', () => {
  it('toggleBold wraps the selection in strong markup', () => {
    select(1, 5);
    commands.toggleBold();
    expect(markdown()).toContain('**text**');
  });

  it('toggleItalic wraps the selection in emphasis markup', () => {
    select(1, 5);
    commands.toggleItalic();
    expect(markdown()).toContain('*text*');
  });

  it('toggleStrike wraps the selection in strikethrough markup', () => {
    select(1, 5);
    commands.toggleStrike();
    expect(markdown()).toContain('~~text~~');
  });

  it('toggleInlineCode wraps the selection in code markup', () => {
    select(1, 5);
    commands.toggleInlineCode();
    expect(markdown()).toContain('`text`');
  });

});

describe('Milkdown block commands', () => {
  it('setHeading(2) turns the current block into a level-2 heading', () => {
    select(1, 1);
    commands.setHeading(2);
    expect(markdown()).toContain('## text');
  });

  it('bulletList wraps the current block in a bullet item', () => {
    select(1, 1);
    commands.bulletList();
    expect(markdown()).toContain('* text');
  });

  it('undo reverts and redo reapplies the last formatting change', () => {
    select(1, 5);
    commands.toggleBold();
    expect(markdown()).toContain('**text**');
    commands.undo();
    expect(markdown()).toBe('text\n');
    commands.redo();
    expect(markdown()).toContain('**text**');
  });

  it('activeState reports bold only while the selection is inside strong text', () => {
    select(1, 5);
    expect(commands.activeState().bold).toBe(false);
    commands.toggleBold();
    select(2, 3);
    expect(commands.activeState().bold).toBe(true);
  });

  it('reports canFormat true and returns inactive state before the editor is ready', () => {
    const notReady = createMilkdownCommands(() => undefined);
    expect(notReady.canFormat).toBe(true);
    expect(notReady.activeState().bold).toBe(false);
    expect(() => notReady.toggleBold()).not.toThrow();
  });

  it('insertCitation inserts the @ trigger that opens the citation flow', () => {
    select(5, 5);
    commands.insertCitation();
    expect(markdown()).toContain('text@');
  });
});

describe('Milkdown command registration', () => {
  it('registers every Crepe TopBar command key the adapter calls', () => {
    const keys = [
      toggleStrongCommand,
      toggleEmphasisCommand,
      toggleStrikethroughCommand,
      toggleInlineCodeCommand,
      toggleLinkCommand,
      setBlockTypeCommand,
      wrapInBlockTypeCommand,
      addBlockTypeCommand,
      undoCommand,
      redoCommand,
    ];
    editor!.action((ctx) => {
      const registry = ctx.get(commandsCtx);
      for (const command of keys) {
        expect(registry.get(command.key)).toBeDefined();
      }
    });
  });
});
