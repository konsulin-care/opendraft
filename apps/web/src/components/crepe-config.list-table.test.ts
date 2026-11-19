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

/**
 * Mount a Crepe instance configured the way a block body is, seeded with
 * the given source.
 *
 * @param body - Block body markdown seeded into the editor.
 * @returns The mounted instance and its root element.
 */
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

/**
 * Find a mounted code block by a marker in its rendered text.
 *
 * @param root - Mounted editor root element.
 * @param marker - Text expected inside the block.
 * @returns The matching code block element, if any.
 */
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
