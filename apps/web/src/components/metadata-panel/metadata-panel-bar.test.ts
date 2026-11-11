import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import { createElement } from 'react';
import { MetadataPanel, metadataPanelStorageKey } from './MetadataPanel';

// @vitest-environment jsdom

const ROOT = 'manuscripts/alpha';
const PROJECT = 'proj-bar';
/** Original `window.matchMedia` descriptor restored after each test. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

/** Stub `window.matchMedia` so the narrow-viewport query never matches. */
function stubWideViewport(): void {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true,
    value: (query: string) => ({ matches: false, media: query,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false }) });
}

/** Seed a memory workspace whose manuscript title is explicitly empty. */
async function seededWorkspace(): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(`${ROOT}/_frontmatter.yml`, 'title: ""\n');
  return ws;
}

/** Render the panel collapsed so the pinned bar text is visible. */
async function renderCollapsedBar(): Promise<void> {
  localStorage.setItem(metadataPanelStorageKey(PROJECT), 'collapsed');
  const ws = await seededWorkspace();
  render(createElement(MetadataPanel, { workspace: ws, manuscriptRoot: ROOT, projectKey: PROJECT }));
  await waitFor(() => expect(screen.getByTestId('metadata-panel-bar-title')).toBeDefined());
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
