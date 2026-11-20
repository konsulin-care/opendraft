import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Editor, rootCtx, defaultValueCtx, commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, setBlockTypeCommand, wrapInBlockTypeCommand, addBlockTypeCommand } from '@milkdown/kit/preset/commonmark';
import { gfm, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { history, undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import { toggleLinkCommand, linkTooltipPlugin } from '@milkdown/kit/component/link-tooltip';
import { getMarkdown } from '@milkdown/kit/utils';
import { TextSelection } from '@milkdown/kit/prose/state';
import { MemoryWorkspace } from '@opendraft/workspace';
import { createCrepeConfig } from '../components/crepe-config';
import { LIST_TABLE_BODY_OFFSET, LIST_TABLE_TEMPLATE } from '../list-table/insert-list-table';
import { createMilkdownCommands } from './milkdown-commands';
import type { EditorCommands } from './types';

/**
 * Stand-in IntersectionObserver that reports every observed element as
 * intersecting on the next frame, so lazily mounted editors mount.
 * (jsdom has no IntersectionObserver; Milkdown's code-block node view
 * creates a shared one as soon as a fence renders.)
 */
class FakeIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  private readonly callback: IntersectionObserverCallback;
  private readonly targets: Element[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    this.targets.push(target);
    const entry = { target, isIntersecting: true } as IntersectionObserverEntry;
    queueMicrotask(() => this.callback([entry], this));
  }

  unobserve(target: Element): void {
    const index = this.targets.indexOf(target);
    if (index >= 0) this.targets.splice(index, 1);
  }

  disconnect(): void {
    this.targets.length = 0;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

let crepe: ReturnType<typeof createCrepeConfig> | undefined;
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
 * Mount a Crepe instance with the block-body feature set and bind the
 * command set, so serialization goes through the Quarto code handler.
 *
 * @param markdown - Initial markdown content.
 */
async function mountCrepe(markdown: string): Promise<void> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  crepe = createCrepeConfig({
    root,
    defaultValue: markdown,
    workspace: new MemoryWorkspace(),
    onStateChangeRef: { current: () => undefined },
  });
  await crepe.create();
  editor = crepe.editor;
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

/** A quarto-div code block observed in the mounted document. */
interface TableInfo {
  text: string;
  language: string;
  cursor: number;
}

/**
 * Find the first quarto-div code block and its cursor offset.
 *
 * @returns Block text, language and cursor offset from content start.
 */
function tableInfo(): TableInfo | undefined {
  let info: TableInfo | undefined;
  editor!.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.state.doc.descendants((node, pos) => {
      if (info || node.type.name !== 'code_block') return;
      const language = String((node.attrs as Record<string, unknown>)['language'] ?? '');
      if (language !== 'quarto-div') return;
      info = { text: node.textContent, language, cursor: view.state.selection.from - (pos + 1) };
    });
  });
  return info;
}

beforeEach(async () => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  await mount('text');
});

afterEach(() => {
  if (crepe) {
    crepe.destroy();
    crepe = undefined;
  } else {
    editor?.destroy();
  }
  editor = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
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

describe('Milkdown table command', () => {
  beforeEach(async () => {
    editor?.destroy();
    editor = undefined;
    document.body.innerHTML = '';
    await mountCrepe('text');
  });

  it('table() inserts a quarto-div code block containing the list-table template', () => {
    select(1, 1);
    commands.table();
    expect(tableInfo()).toEqual({
      text: LIST_TABLE_TEMPLATE,
      language: 'quarto-div',
      cursor: LIST_TABLE_BODY_OFFSET,
    });
  });

  it('table() leaves the cursor on the blank body line', () => {
    select(1, 1);
    commands.table();
    expect(tableInfo()?.cursor).toBe(LIST_TABLE_BODY_OFFSET);
  });

  it('serializes the template without placeholder text right after table()', () => {
    select(1, 1);
    commands.table();
    const output = markdown();
    expect(output).toContain(LIST_TABLE_TEMPLATE);
    expect(output).not.toContain('Insert your table caption here');
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
