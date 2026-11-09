// @vitest-environment jsdom
/**
 * BlockEditor collapsed-header test: a collapsed block's header shows the
 * body word count loaded with the block list, before any editor for it
 * has mounted. The expanded sibling proves the observer stub makes
 * mounting possible, so the collapsed block's missing editor is a
 * consequence of collapsing, not of the environment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { BlockEditor } from './BlockEditor';
import { blockCollapseStorageKey } from './use-collapse-state';

/** Manuscript directory used by the fixture. */
const DIR = 'manuscripts/demo';

/** Path of the assembly under test. */
const ARTICLE = `${DIR}/article.qmd`;

/** Path of the block directory under test. */
const BLOCKS = `${DIR}/blocks`;

/** Project key scoping the persisted collapse state. */
const PROJECT_KEY = 'block-editor-collapsed-test';

/**
 * Stand-in IntersectionObserver that reports every observed element as
 * intersecting on the next frame, so lazily mounted editors mount.
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

/**
 * Build an assembly listing the given short names in include order.
 *
 * @param shorts - Block short names in include order.
 * @returns article.qmd text with front matter and a refs fence.
 */
function articleWith(...shorts: string[]): string {
  const includes = shorts.map((short) => `{{< include blocks/${short}.qmd >}}`).join('\n\n');
  return `---\nmetadata-files:\n- _author.yml\n---\n\n${includes}\n\n::: {#refs}\n:::\n`;
}

/**
 * Build canonical block file text.
 *
 * @param short - Block short name used for the anchor.
 * @param title - Heading title.
 * @param body - Block body after the heading line.
 * @returns Block file text opening with a canonical heading.
 */
function blockFile(short: string, title: string, body = ''): string {
  return `# ${title} {#sec-${short} .deo-section}\n${body}`;
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  localStorage.clear();
  // Only the intro block starts collapsed; methods stays expanded.
  localStorage.setItem(
    blockCollapseStorageKey(PROJECT_KEY),
    JSON.stringify({ intro: true }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('collapsed block header word count', () => {
  it('shows the loaded body word count without the editor having mounted', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(ARTICLE, articleWith('intro', 'methods'));
    await ws.writeFile(
      `${BLOCKS}/intro.qmd`,
      blockFile('intro', 'Introduction', 'One two three four five.\n'),
    );
    await ws.writeFile(
      `${BLOCKS}/methods.qmd`,
      blockFile('methods', 'Methods', 'Alpha beta gamma.\n'),
    );

    render(<BlockEditor ws={ws} dir={DIR} projectKey={PROJECT_KEY} />);

    const introToggle = await screen.findByRole('button', { name: 'Introduction section' });
    expect(introToggle).toHaveAttribute('aria-expanded', 'false');
    const introSection = introToggle.closest('section');
    expect(introSection).not.toBeNull();

    // Seeded from the block list: five body words, heading excluded.
    expect(introSection).toHaveTextContent('5 words');

    // No editor mounted for the collapsed block...
    expect(
      within(introSection as HTMLElement).queryByTestId('block-body-editor'),
    ).toBeNull();

    // ...while the expanded sibling mounts, proving the stub enables it.
    const methodsSection = screen
      .getByRole('button', { name: 'Methods section' })
      .closest('section') as HTMLElement;
    await waitFor(
      () => {
        expect(within(methodsSection).getByTestId('block-body-editor')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });
});
