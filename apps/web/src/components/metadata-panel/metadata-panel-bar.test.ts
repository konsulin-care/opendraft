import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import { createElement } from 'react';
import { MetadataPanel, metadataPanelStorageKey } from './MetadataPanel';

// @vitest-environment jsdom

const ROOT = 'manuscripts/alpha';
const PROJECT = 'proj-bar';
const NARROW_PROJECT = 'proj-bar-narrow';
const ONE_AUTHOR_PROJECT = 'proj-bar-one';
const TITLE = 'A comprehensive and deliberately long manuscript title';
const AUTHORS = 'authors:\n  - name:\n      given: Alice Marie\n      family: Smith\n  - name:\n      given: Budi\n      family: Lee\n';
const ONE_AUTHOR = 'authors:\n  - name:\n      given: Alice Marie\n      family: Smith\n';
/** Original `window.matchMedia` descriptor restored after each test. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

/**
 * Stub `window.matchMedia` so only the narrow-viewport query matches
 * when requested.
 *
 * @param narrow - Whether the 767px (below md) query should match.
 */
function stubViewport(narrow: boolean): void {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true,
    value: (query: string) => ({ matches: narrow && query.includes('767'), media: query,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false }) });
}

/** Stub `window.matchMedia` so the narrow-viewport query never matches. */
function stubWideViewport(): void {
  stubViewport(false);
}

/**
 * Seed a memory workspace with the given files.
 *
 * @param seed - Repo-relative path to file contents.
 * @returns The populated workspace.
 */
async function seededWorkspace(seed: Record<string, string>): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(seed)) await ws.writeFile(path, content);
  return ws;
}

/** Seed a memory workspace whose manuscript title is explicitly empty. */
async function seededEmptyTitleWorkspace(): Promise<WorkspaceAdapter> {
  return seededWorkspace({ [`${ROOT}/_frontmatter.yml`]: 'title: ""\n' });
}

/** Render the panel collapsed so the pinned bar text is visible. */
async function renderCollapsedBar(): Promise<void> {
  localStorage.setItem(metadataPanelStorageKey(PROJECT), 'collapsed');
  const ws = await seededEmptyTitleWorkspace();
  render(createElement(MetadataPanel, { workspace: ws, manuscriptRoot: ROOT, projectKey: PROJECT }));
  await waitFor(() => expect(screen.getByTestId('metadata-panel-bar-title')).toBeDefined());
}

/**
 * Render the panel with the given seed and project, collapsed when asked.
 *
 * @param seed - Repo-relative path to file contents.
 * @param project - Project key used for the collapsed state.
 * @param collapsed - Whether to seed the persisted collapsed state.
 */
async function renderPanel(
  seed: Record<string, string>,
  project: string,
  collapsed: boolean,
): Promise<void> {
  if (collapsed) localStorage.setItem(metadataPanelStorageKey(project), 'collapsed');
  const ws = await seededWorkspace(seed);
  render(createElement(MetadataPanel, { workspace: ws, manuscriptRoot: ROOT, projectKey: project }));
  await waitFor(() => expect(screen.getByTestId('metadata-panel')).toBeDefined());
}

beforeEach(() => {
  localStorage.clear();
  stubWideViewport();
});

afterEach(() => {
  localStorage.clear();
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
});

describe('Pinned bar empty-title fallback', () => {
  it('shows the manuscript folder id in muted text and no "Untitled manuscript"', async () => {
    await renderCollapsedBar();
    const barTitle = screen.getByTestId('metadata-panel-bar-title');
    // The folder id replaces the title slot, styled muted like other secondary text.
    expect(barTitle.textContent).toBe('alpha');
    expect(barTitle.querySelector('.text-muted')?.textContent).toBe('alpha');
    expect(screen.queryByText('Untitled manuscript')).toBeNull();
  });
});

describe('Pinned bar byline', () => {
  it('shows short Vancouver names in the collapsed bar and full names when expanded', async () => {
    const seed = { [`${ROOT}/_frontmatter.yml`]: `title: "${TITLE}"\n`, [`${ROOT}/_author.yml`]: AUTHORS };
    await renderPanel(seed, PROJECT, true);
    expect(screen.getByTestId('metadata-panel-byline').textContent).toBe('Smith A. M., Lee B.');
    fireEvent.click(screen.getByTestId('metadata-panel-toggle'));
    expect(screen.queryByTestId('metadata-panel-byline')).toBeNull();
    expect(screen.getByTestId('article-byline').textContent).toContain('Alice Marie Smith');
    expect(screen.getByTestId('article-byline').textContent).toContain('Budi Lee');
  });

  it('reads "1 author" for a single author on a narrow viewport', async () => {
    stubViewport(true);
    await renderPanel(
      { [`${ROOT}/_frontmatter.yml`]: `title: "${TITLE}"\n`, [`${ROOT}/_author.yml`]: ONE_AUTHOR },
      ONE_AUTHOR_PROJECT,
      true,
    );
    expect(screen.getByTestId('metadata-panel-byline').textContent).toBe('1 author');
  });

  it('reads "2 authors" for two authors on a narrow viewport', async () => {
    stubViewport(true);
    await renderPanel(
      { [`${ROOT}/_frontmatter.yml`]: `title: "${TITLE}"\n`, [`${ROOT}/_author.yml`]: AUTHORS },
      NARROW_PROJECT,
      true,
    );
    expect(screen.getByTestId('metadata-panel-byline').textContent).toBe('2 authors');
  });
});

describe('Pinned bar title wrapping', () => {
  it('wraps the full title without truncate or line-clamp classes', async () => {
    await renderPanel(
      { [`${ROOT}/_frontmatter.yml`]: `title: "${TITLE}"\n`, [`${ROOT}/_author.yml`]: AUTHORS },
      PROJECT,
      true,
    );
    const barTitle = screen.getByTestId('metadata-panel-bar-title');
    expect(barTitle.textContent).toBe(TITLE);
    expect(barTitle.className).not.toContain('truncate');
    expect(barTitle.className).not.toContain('line-clamp');
    expect(barTitle.className).toContain('break-words');
  });
});
