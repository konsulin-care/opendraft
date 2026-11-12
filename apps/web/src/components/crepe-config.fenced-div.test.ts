import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMarkdown } from '@milkdown/kit/utils';
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

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Mount a Crepe instance configured the way a block body is (same
 * `createCrepeConfig` path) seeded with the given source, then
 * serialize its document back to markdown.
 *
 * @param body - Block body markdown seeded into the editor.
 * @returns The serializer output for the seeded document.
 */
async function serializeBody(body: string): Promise<string> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const crepe = createCrepeConfig({
    root,
    defaultValue: body,
    workspace: new MemoryWorkspace(),
    onStateChangeRef: { current: () => undefined },
  });
  await crepe.create();
  try {
    return crepe.editor.action(getMarkdown());
  } finally {
    crepe.destroy();
    root.remove();
  }
}

/** Compare ignoring trailing newlines (contract: modulo one trailing newline). */
function normalized(text: string): string {
  return text.replace(/\n+$/, '');
}

describe('createCrepeConfig — Pandoc fenced div serialization', () => {
  it('serializes a ::: {.list-table} div with nested rows and a colspan cell unchanged', async () => {
    const input = [
      '::: {.list-table}',
      '- - Row 1, column 1',
      '  - Row 1, column 2',
      '',
      '- - Row 2, column 1',
      '  - []{colspan=2}',
      ':::',
      '',
    ].join('\n');
    const markdown = await serializeBody(input);
    expect(normalized(markdown)).toBe(normalized(input));
  });

  it('serializes an attributed ::: {#tbl-x .list-table ...} div with a caption unchanged', async () => {
    const input = [
      '::: {#tbl-x .list-table aligns="l,r" tbl-colwidths="[75,25]"}',
      '',
      '*Table 1: Results by group.*',
      '',
      ':::',
      '',
    ].join('\n');
    const markdown = await serializeBody(input);
    expect(normalized(markdown)).toBe(normalized(input));
  });

  it('round-trips a callout div and an empty ::: {#refs} div among paragraphs unchanged', async () => {
    const input = [
      'Opening paragraph.',
      '',
      '::: {.callout-note}',
      'Mind the gap.',
      ':::',
      '',
      'Middle paragraph.',
      '',
      '::: {#refs}',
      ':::',
      '',
      'Closing paragraph.',
      '',
    ].join('\n');
    const markdown = await serializeBody(input);
    expect(normalized(markdown)).toBe(normalized(input));
  });
});
