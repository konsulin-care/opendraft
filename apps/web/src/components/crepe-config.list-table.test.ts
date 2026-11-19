import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { MemoryWorkspace } from '@opendraft/workspace';
import { LIST_TABLE_TEMPLATE } from '../list-table/insert-list-table';
import { buildListTableMenu } from '../list-table/list-table-slash-item';
import { createCrepeConfig } from './crepe-config';

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

/** Mounted Crepe instance and the root element holding its DOM. */
interface Mounted {
  root: HTMLElement;
  crepe: ReturnType<typeof createCrepeConfig>;
}

let mounted: Mounted | null = null;

/** Mount a Crepe instance configured the way a block body is. */
async function mountBody(body: string): Promise<Mounted> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const crepe = createCrepeConfig({
    root,
    defaultValue: body,
    workspace: new MemoryWorkspace(),
    onStateChangeRef: { current: () => undefined },
  });
  await crepe.create();
  mounted = { root, crepe };
  return mounted;
}

/** A quarto-div code block observed in the mounted document. */
interface DivBlockInfo {
  text: string;
  language: string;
  cursor: number;
}

/** Result of driving the fence input rule in a mounted editor. */
interface TypingResult {
  handled: boolean;
  block: DivBlockInfo | undefined;
  paragraphText: string | null;
}

/** Read the ProseMirror view of a mounted Crepe instance. */
function getView(crepe: Mounted['crepe']): EditorView {
  return crepe.editor.action((ctx) => ctx.get(editorViewCtx));
}

/** Append text to the last paragraph and put the cursor after it. */
function insertIntoLastParagraph(view: EditorView, text: string): number {
  let from = -1;
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph') from = pos + 1 + node.content.size;
  });
  if (from < 0) return -1;
  const tr = view.state.tr.insertText(text, from, from);
  tr.setSelection(TextSelection.create(tr.doc, from + text.length));
  view.dispatch(tr);
  return from + text.length;
}

/** Find the first quarto-div code block in the document. */
function findDivBlock(view: EditorView): DivBlockInfo | undefined {
  let info: DivBlockInfo | undefined;
  view.state.doc.descendants((node, pos) => {
    if (info || node.type.name !== 'code_block') return;
    const language = String((node.attrs as Record<string, unknown>)['language'] ?? '');
    if (language !== 'quarto-div') return;
    info = { text: node.textContent, language, cursor: view.state.selection.from - (pos + 1) };
  });
  return info;
}

/** Read the last paragraph's text. */
function lastParagraphText(view: EditorView): string | null {
  let text: string | null = null;
  view.state.doc.descendants((node) => {
    if (node.type.name === 'paragraph') text = node.textContent;
  });
  return text;
}

/** Type a fence prefix and a space through the input-rule handler. */
async function typeFence(body: string, prefix: string): Promise<TypingResult> {
  const { crepe } = await mountBody(body);
  const view = getView(crepe);
  const pos = insertIntoLastParagraph(view, prefix);
  const deflt = () => view.state.tr.insertText(' ', pos, pos);
  const handled =
    view.someProp('handleTextInput', (handler) =>
      handler(view, pos, pos, ' ', deflt),
    ) ?? false;
  if (!handled && pos >= 0) {
    view.dispatch(view.state.tr.insertText(' ', pos, pos));
  }
  return { handled, block: findDivBlock(view), paragraphText: lastParagraphText(view) };
}

/** A list-table div with a caption, header row and one body row. */
const TABLE_DIV = [
  '::: {#tbl-results .list-table}',
  '',
  'Results caption',
  '',
  '- - Head A',
  '  - Head B',
  '',
  '- - Cell A',
  '  - Cell B',
  ':::',
].join('\n');

/** Find a mounted code block by a marker in its rendered text. */
function findCodeBlock(root: HTMLElement, marker: string): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>('.milkdown-code-block')).find((block) =>
    block.textContent?.includes(marker),
  );
}

/** Slash-item fields captured from a fake group builder. */
interface CapturedSlashItem {
  key: string;
  label: string;
  icon: string;
  onRun: (ctx: Ctx) => void;
}

/** Run buildListTableMenu against a fake builder and capture its item. */
function captureListTableItem(): CapturedSlashItem {
  let captured: CapturedSlashItem | null = null;
  buildListTableMenu({
    getGroup: () => ({
      addItem: (key, item) => {
        captured = { key, ...item };
        return undefined;
      },
    }),
  });
  if (!captured) throw new Error('list-table item not captured');
  return captured;
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  mounted?.crepe.destroy();
  mounted?.root.remove();
  mounted = null;
  vi.unstubAllGlobals();
});

describe('createCrepeConfig — list-table preview panel', () => {
  it('renders a preview panel containing a table below a list-table div', async () => {
    const { root } = await mountBody(TABLE_DIV);

    await vi.waitFor(() => {
      expect(root.querySelector('.preview-panel')).not.toBeNull();
    });

    const panel = root.querySelector('.preview-panel');
    expect(panel?.querySelector('table')).not.toBeNull();
    expect(panel?.textContent).toContain('Results caption');
  });

  it('shows the list-table placeholder and no preview table for a blank body', async () => {
    const { root } = await mountBody('::: {.list-table}\n\n:::');

    await vi.waitFor(() => {
      expect(root.querySelector('.cm-list-table-placeholder')).not.toBeNull();
    });

    expect(root.querySelector('.preview-panel table')).toBeNull();
  });

  it('marks a quarto-div code block but not a python code block', async () => {
    const { root } = await mountBody(
      '::: {.callout-note}\n\nText\n:::\n\n```python\nprint(1)\n```',
    );

    await vi.waitFor(() => {
      expect(findCodeBlock(root, 'callout-note')).not.toBeUndefined();
    });

    expect(findCodeBlock(root, 'callout-note')?.classList.contains('quarto-div-block')).toBe(
      true,
    );
    expect(findCodeBlock(root, 'print(1)')?.classList.contains('quarto-div-block')).toBe(false);
  });

  it('renders no preview table for a non-list-table div', async () => {
    const { root } = await mountBody('::: {.callout-note}\n\nText\n:::');

    await vi.waitFor(() => {
      expect(root.querySelector('.milkdown-code-block')).not.toBeNull();
    });

    expect(root.querySelector('.preview-panel table')).toBeNull();
  });
});

describe('createCrepeConfig — list-table slash item', () => {
  it('adds a Table item to the advanced slash-menu group', () => {
    const item = captureListTableItem();
    expect(item.key).toBe('list-table');
    expect(item.label).toBe('Table');
    expect(item.icon).toContain('<svg');
  });

  it('replaces the slash paragraph with the quarto-div template when run', async () => {
    const item = captureListTableItem();
    const { crepe } = await mountBody('/');
    const view = getView(crepe);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 2)));
    crepe.editor.action((ctx) => item.onRun(ctx));
    expect(findDivBlock(view)?.language).toBe('quarto-div');
    expect(findDivBlock(view)?.text).toBe(LIST_TABLE_TEMPLATE);
    expect(lastParagraphText(view) ?? '').not.toContain('/');
  });
});

describe('createCrepeConfig — fenced div input rule', () => {
  it('turns a bare ::: fence into a quarto-div block with the cursor on line 1', async () => {
    const { handled, block } = await typeFence('', ':::');

    expect(handled).toBe(true);
    expect(block?.language).toBe('quarto-div');
    expect(block?.text).toBe('::: \n\n:::');
    expect(block?.cursor).toBe(4);
  });

  it('turns a :::{.list-table} fence into a block with the cursor on the blank body line', async () => {
    const { handled, block } = await typeFence('', ':::{.list-table}');

    expect(handled).toBe(true);
    expect(block?.text).toBe(':::{.list-table}\n\n:::');
    expect(block?.cursor).toBe(':::{.list-table}'.length + 1);
  });

  it('leaves a paragraph unchanged when the fence follows other text', async () => {
    const { handled, block, paragraphText } = await typeFence('', 'Existing :::');

    expect(handled).toBe(false);
    expect(block).toBeUndefined();
    expect(paragraphText).toBe('Existing ::: ');
  });
});
