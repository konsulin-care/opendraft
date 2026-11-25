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

/** A display-math block, rendered as a LaTeX code block by Crepe. */
const MATH_BLOCK = ['$$', 'x^2 + y^2', '$$'].join('\n');

/** Find a mounted code block by a marker in its rendered text. */
function findCodeBlock(root: HTMLElement, marker: string): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>('.milkdown-code-block')).find((block) =>
    block.textContent?.includes(marker),
  );
}

/** The source host of a code block located by a marker. */
function getSourceHost(root: HTMLElement, marker: string): HTMLElement | null {
  return findCodeBlock(root, marker)?.querySelector<HTMLElement>('.codemirror-host') ?? null;
}

/** Whether a code block's source is hidden behind its rendered preview. */
function sourceHidden(root: HTMLElement, marker: string): boolean {
  return getSourceHost(root, marker)?.classList.contains('hidden') ?? false;
}

/** Click the rendered preview panel of a code block. */
function clickPreview(root: HTMLElement, marker: string): void {
  const panel = findCodeBlock(root, marker)?.querySelector<HTMLElement>('.preview-panel');
  if (!panel) throw new Error(`preview panel not found for ${marker}`);
  panel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

describe('preview-click-to-edit', () => {
  it('reveals a hidden list-table source when its preview is clicked', async () => {
    const { root } = await mountBody(TABLE_DIV);

    await vi.waitFor(() => {
      expect(sourceHidden(root, 'list-table')).toBe(true);
    });

    clickPreview(root, 'list-table');

    await vi.waitFor(() => {
      expect(sourceHidden(root, 'list-table')).toBe(false);
    });
  });

  it('reveals a hidden LaTeX math source when its preview is clicked', async () => {
    const { root } = await mountBody(MATH_BLOCK);

    await vi.waitFor(() => {
      expect(sourceHidden(root, 'x^2')).toBe(true);
    });

    clickPreview(root, 'x^2');

    await vi.waitFor(() => {
      expect(sourceHidden(root, 'x^2')).toBe(false);
    });
  });

  it('leaves the source hidden in a read-only editor', async () => {
    const { root, crepe } = await mountBody(TABLE_DIV);

    await vi.waitFor(() => {
      expect(sourceHidden(root, 'list-table')).toBe(true);
    });

    crepe.setReadonly(true);
    clickPreview(root, 'list-table');

    // Give the (rejected) toggle a frame to run: the source stays hidden.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sourceHidden(root, 'list-table')).toBe(true);
  });
});
