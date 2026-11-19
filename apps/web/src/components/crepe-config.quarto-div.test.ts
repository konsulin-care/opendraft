import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMarkdown } from '@milkdown/kit/utils';
import { editorViewCtx } from '@milkdown/kit/core';
import type { Editor } from '@milkdown/kit/core';
import type { Node as PmNode } from '@milkdown/kit/prose/model';
import type { Crepe } from '@milkdown/crepe';
import { MemoryWorkspace } from '@opendraft/workspace';
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

/** Live mounted editor plus its container, torn down in afterEach. */
interface Mounted {
  crepe: Crepe;
  editor: Editor;
  root: HTMLElement;
}

let mounted: Mounted | null = null;

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  mounted?.crepe.destroy();
  mounted?.root.remove();
  mounted = null;
  vi.unstubAllGlobals();
});

/**
 * Mount a Crepe instance configured the way a block body is (same
 * `createCrepeConfig` path) seeded with the given source.
 *
 * @param body - Block body markdown seeded into the editor.
 * @returns The live mounted editor, kept for afterEach teardown.
 */
async function mountBody(body: string): Promise<Editor> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const crepe = createCrepeConfig({
    root,
    defaultValue: body,
    workspace: new MemoryWorkspace(),
    onStateChangeRef: { current: () => undefined },
  });
  await crepe.create();
  mounted = { crepe, editor: crepe.editor, root };
  return crepe.editor;
}

/**
 * Mount a Crepe instance, serialize it, then tear it down immediately.
 *
 * @param body - Block body markdown seeded into the editor.
 * @returns The serializer output for the seeded document.
 */
async function serializeBody(body: string): Promise<string> {
  const editor = await mountBody(body);
  const markdown = editor.action(getMarkdown());
  mounted?.crepe.destroy();
  mounted?.root.remove();
  mounted = null;
  return markdown;
}

/** Collect every `code_block` node with its document position. */
function findCodeBlocks(editor: Editor): Array<{ pos: number; node: PmNode }> {
  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const found: Array<{ pos: number; node: PmNode }> = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'code_block') found.push({ pos, node });
      return true;
    });
    return found;
  });
}

/** Replace the text of the document's first code block with `text`. */
function replaceFirstBlockText(editor: Editor, text: string): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const first = findCodeBlocks(editor)[0];
    if (!first) throw new Error('expected a code_block');
    view.dispatch(
      view.state.tr.replaceWith(
        first.pos + 1,
        first.pos + first.node.nodeSize - 1,
        view.state.schema.text(text),
      ),
    );
  });
}

/** Compare ignoring trailing newlines (contract: modulo one trailing newline). */
function normalized(text: string): string {
  return text.replace(/\n+$/, '');
}

describe('createCrepeConfig — editable quarto-div code blocks', () => {
  it('loads a ::: div as a quarto-div code_block holding the raw source', async () => {
    const body = ['::: {.callout-note}', 'Mind the gap.', ':::'].join('\n');
    const editor = await mountBody(body);
    const [first] = findCodeBlocks(editor);
    expect(first).toBeDefined();
    expect(String((first.node.attrs as Record<string, unknown>)['language'] ?? '')).toBe(
      'quarto-div',
    );
    expect(first.node.textContent).toBe(body);
  });

  it('serializes an edited quarto-div block verbatim, without a fence or escaping', async () => {
    const editor = await mountBody(['::: {.callout-note}', 'old', ':::'].join('\n'));
    const text = ['::: {.callout-tip}', 'Backtick ` and backslash \\ kept.', ':::'].join('\n');
    replaceFirstBlockText(editor, text);
    expect(normalized(editor.action(getMarkdown()))).toBe(text);
  });

  it('round-trips untouched divs byte-for-byte', async () => {
    const cases = [
      [
        '::: {.list-table}',
        '- - Row 1, column 1',
        '  - Row 1, column 2',
        '',
        '- - Row 2, column 1',
        '  - []{colspan=2}',
        ':::',
        '',
      ].join('\n'),
      [
        '::: {#tbl-x .list-table aligns="l,r" tbl-colwidths="[75,25]"}',
        '',
        '*Table 1: Results by group.*',
        '',
        ':::',
        '',
      ].join('\n'),
      ['::: {.callout-note}', 'Mind the gap.', ':::', ''].join('\n'),
      ['::: {#refs}', ':::', ''].join('\n'),
    ];
    for (const input of cases) {
      const markdown = await serializeBody(input);
      expect(normalized(markdown)).toBe(normalized(input));
    }
  });
});
