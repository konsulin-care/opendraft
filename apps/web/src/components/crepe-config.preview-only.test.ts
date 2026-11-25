import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  mounted?.crepe.destroy();
  mounted?.root.remove();
  mounted = null;
  vi.unstubAllGlobals();
});

describe('createCrepeConfig — preview-only code blocks', () => {
  it('hides the source of a list-table block that has a rendered preview', async () => {
    const { root } = await mountBody(TABLE_DIV);

    await vi.waitFor(() => {
      const host = findCodeBlock(root, 'list-table')?.querySelector('.codemirror-host');
      expect(host?.classList.contains('hidden')).toBe(true);
    });

    const block = findCodeBlock(root, 'list-table');
    expect(block?.querySelector('.codemirror-host')?.classList.contains('hidden')).toBe(true);
    const panel = block?.querySelector('.preview-panel');
    expect(panel?.querySelector('table')).not.toBeNull();
    expect(panel?.textContent).toContain('Results caption');
  });

  it('keeps the source editor visible on a plain code block without a preview', async () => {
    const { root } = await mountBody('```python\nprint(1)\n```');

    await vi.waitFor(() => {
      expect(findCodeBlock(root, 'print(1)')).not.toBeUndefined();
    });

    const host = findCodeBlock(root, 'print(1)')?.querySelector('.codemirror-host');
    expect(host).not.toBeNull();
    expect(host?.classList.contains('hidden')).toBe(false);
  });
});
