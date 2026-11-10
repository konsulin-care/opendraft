// @vitest-environment jsdom
/**
 * BlockEditor retitle tests: committing a new title renames the block
 * file and its reference chip while the block keeps its collapsed or
 * expanded state, and a renaming retitle remounts the other open block
 * bodies so a later autosave cannot write the pre-rename `@sec-` refs
 * back. Moved out of BlockEditor.test.tsx, which sits at the
 * 300-line max-lines ceiling.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockEditor } from './BlockEditor';
import { blockCollapseStorageKey } from './use-collapse-state';
import { createTestApi, getActiveBlockEditor } from '../caret-mode-switch';
import type { EditorTestApi } from '../caret-mode-switch';

vi.mock('../caret-mode-switch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../caret-mode-switch')>()),
  requestFocusForShort: vi.fn(),
}));

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Path of the assembly under test. */
const ARTICLE = `${DIR}/article.qmd`;

/** Path of the block directory under test. */
const BLOCKS = `${DIR}/blocks`;

/** Debounce window of the shared autosave plus the listener lag. */
const SAVE_WINDOW_MS = 1500;

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

/**
 * Write a fixture assembly into a fresh workspace and render the shell.
 *
 * @param files - Repo-relative paths mapped to file contents.
 * @returns The workspace the rendered editor reads and writes.
 */
async function setup(files: Record<string, string>): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(files)) {
    await ws.writeFile(path, content);
  }
  render(<BlockEditor ws={ws} dir={DIR} projectKey="block-editor-test" />);
  await screen.findAllByTestId('block-title');
  return ws;
}

describe('BlockEditor rename on title commit', () => {
  it('renames the block and its reference chip when a new title is committed', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha', 'Body.\n'),
    });
    const title = screen.getByTestId('block-title');
    fireEvent.change(title, { target: { value: 'Background' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    await waitFor(async () => {
      expect(await ws.readFile(`${BLOCKS}/background.qmd`)).toBe(
        '# Background {#sec-background .deo-section}\nBody.\n',
      );
    });
    expect(await ws.readFile(`${BLOCKS}/alpha.qmd`)).toBeNull();
    expect(await ws.readFile(ARTICLE)).toContain(
      '{{< include blocks/background.qmd >}}',
    );
    expect(
      await screen.findByRole('button', { name: 'Copy @sec-background reference' }),
    ).toBeInTheDocument();
  });
});

describe('BlockEditor rename keeps collapse state', () => {
  it('keeps the collapsed state when the block is renamed', async () => {
    localStorage.clear();
    localStorage.setItem(
      blockCollapseStorageKey('block-editor-test'),
      JSON.stringify({ alpha: true }),
    );
    const ws = await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha', 'Body.\n'),
    });
    expect(screen.getByRole('button', { name: 'Alpha section' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    const title = screen.getByTestId('block-title');
    fireEvent.change(title, { target: { value: 'Background' } });
    fireEvent.keyDown(title, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Background section' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
    expect(await ws.readFile(`${BLOCKS}/background.qmd`)).not.toBeNull();
    expect(
      JSON.parse(localStorage.getItem(blockCollapseStorageKey('block-editor-test')) ?? '{}'),
    ).toEqual({ background: true });
    localStorage.clear();
  });
});

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
 * Focus beta's ProseMirror surface so the block-editor registry names
 * beta's editor as the active target.
 */
function focusBetaSurface(): void {
  const toggle = screen.getByRole('button', { name: 'Beta section' });
  const section = toggle.closest('section');
  expect(section).not.toBeNull();
  const surface = (section as HTMLElement).querySelector('.ProseMirror');
  expect(surface).not.toBeNull();
  fireEvent.focusIn(surface as Element);
}

/**
 * Wait until beta's (re)mounted editor is wired and its markdown holds
 * the given fragment, then return its imperative API. Retries through
 * the remount gap where no ProseMirror surface exists yet.
 *
 * @param fragment - Markdown fragment identifying beta's editor.
 * @returns The test API bound to beta's mounted editor.
 */
async function waitForBetaApi(fragment: string): Promise<EditorTestApi> {
  let found: EditorTestApi | null = null;
  await waitFor(() => {
    focusBetaSurface();
    const editor = getActiveBlockEditor();
    if (editor === undefined) throw new Error('no block editor registered yet');
    const api = createTestApi(editor);
    if (!api.getMarkdown().includes(fragment)) {
      throw new Error(`active editor markdown lacks ${fragment}`);
    }
    found = api;
  }, { timeout: 10000 });
  // TS cannot see the closure assignment (it narrows `found` to null);
  // the guard keeps the return type-true without a rejected cast.
  if (found === null) throw new Error('beta editor never became ready');
  return found;
}

describe('BlockEditor renaming retitle reloads open bodies', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('reloads other open blocks so a later autosave never writes @sec-<old> back', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha', 'Alpha body.\n'),
      [`${BLOCKS}/beta.qmd`]: blockFile('beta', 'Beta', 'See @sec-alpha for details.\n'),
    });

    // Both bodies mount (observer stub) and beta's editor holds the old ref.
    await waitForBetaApi('@sec-alpha');

    // Renaming retitle alpha -> background rewrites @sec- refs on disk.
    const title = screen.getAllByTestId('block-title')[0];
    fireEvent.change(title, { target: { value: 'Background' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    await waitFor(async () => {
      expect(await ws.readFile(`${BLOCKS}/background.qmd`)).not.toBeNull();
      expect(await ws.readFile(`${BLOCKS}/alpha.qmd`)).toBeNull();
    }, { timeout: 10000 });

    // Beta's row remounted and re-read the rewritten file.
    const api = await waitForBetaApi('@sec-background');

    // A later autosave from beta can no longer resurrect the old ref.
    await act(async () => {
      api.insertText(' Checked.');
    });
    await waitFor(async () => {
      const saved = await ws.readFile(`${BLOCKS}/beta.qmd`);
      expect(saved).toContain('@sec-background');
      expect(saved).not.toContain('@sec-alpha');
      expect(saved).toContain('Checked.');
    }, { timeout: SAVE_WINDOW_MS + 5000 });
  }, 30000);
});
