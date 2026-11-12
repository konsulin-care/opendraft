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

describe('createCrepeConfig — Quarto chunk serialization', () => {
  it('returns seeded ```{r} and ```{r label, echo=FALSE} chunks unchanged', async () => {
    const input = '```{r}\ncode\n```\n\n```{r label, echo=FALSE}\ncode\n```\n';
    const markdown = await serializeBody(input);
    expect(normalized(markdown)).toBe(normalized(input));
  });

  it('keeps the ```{python} header and #| option lines unchanged', async () => {
    const input = '```{python}\n#| echo: false\nx = 1\n```\n';
    const markdown = await serializeBody(input);
    expect(markdown).toContain('```{python}\n');
    expect(markdown).toContain('#| echo: false\n');
    expect(normalized(markdown)).toBe(normalized(input));
  });

  it('serializes a standard ```r fence as ```r with no braces added', async () => {
    const input = '```r\ncode\n```\n';
    const markdown = await serializeBody(input);
    expect(markdown).toContain('```r\n');
    expect(markdown).not.toContain('{r}');
  });
});
