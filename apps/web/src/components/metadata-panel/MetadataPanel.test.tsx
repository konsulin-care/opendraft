import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import type { RefObject } from 'react';
import { ManuscriptEditor } from '../ManuscriptEditor';
import {
  MetadataPanel,
  manuscriptRootFromPath,
  metadataPanelStorageKey,
} from './MetadataPanel';

// @vitest-environment jsdom

const ROOT = 'manuscripts/x';
const PROJECT = 'proj-d2';
const FRONTMATTER = 'title: "Deep Dive"\n';
const AUTHORS = `authors:
  - name:
      given: Alice Marie
      family: Smith
  - name:
      given: Budi
      family: Lee
`;

/** Original `window.matchMedia` descriptor restored after each test. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

/**
 * Stub `window.matchMedia` so the narrow-viewport query matches or not.
 *
 * @param narrow - Whether viewports below 640px should report as active.
 */
function stubNarrowViewport(narrow: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: narrow && query.includes('639'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

/**
 * Seed a memory workspace with manuscript metadata files.
 *
 * @param seed - Files keyed by repo-relative path.
 * @returns The populated workspace adapter.
 */
async function seededWorkspace(seed: Record<string, string>): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(seed)) await ws.writeFile(path, content);
  return ws;
}

/**
 * Render {@link MetadataPanel} and wait until its initial load settled.
 *
 * @param ws - Workspace the metadata is read from.
 * @param focusRef - Editor container focused when Esc collapses the panel.
 * @returns The render result.
 */
async function renderPanel(ws: WorkspaceAdapter, focusRef?: RefObject<HTMLElement | null>) {
  const rendered = render(
    <MetadataPanel
      workspace={ws}
      manuscriptRoot={ROOT}
      projectKey={PROJECT}
      editorFocusRef={focusRef}
    />,
  );
  await waitFor(() => expect(screen.getByTestId('metadata-panel')).toBeDefined());
  return rendered;
}

beforeEach(() => {
  localStorage.clear();
  stubNarrowViewport(false);
});

afterEach(() => {
  localStorage.clear();
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
});

describe('manuscriptRootFromPath', () => {
  it('returns the manuscript root for files under manuscripts/<id>/', () => {
    expect(manuscriptRootFromPath('manuscripts/x/blocks/A.qmd')).toBe('manuscripts/x');
  });

  it('returns null for files outside a manuscript', () => {
    expect(manuscriptRootFromPath('opendraft.yml')).toBeNull();
  });
});

describe('MetadataPanel collapsed bar', () => {
  it('shows the title and given-then-family byline names', async () => {
    const ws = await seededWorkspace({
      [`${ROOT}/_frontmatter.yml`]: FRONTMATTER,
      [`${ROOT}/_author.yml`]: AUTHORS,
    });
    await renderPanel(ws);
    expect(screen.getByTestId('metadata-panel-bar-title').textContent).toBe('Deep Dive');
    expect(screen.getByTestId('metadata-panel-byline').textContent).toContain(
      'Alice Marie Smith, Budi Lee',
    );
  });

  it('shows "N authors" below the 640px breakpoint', async () => {
    stubNarrowViewport(true);
    const ws = await seededWorkspace({
      [`${ROOT}/_frontmatter.yml`]: FRONTMATTER,
      [`${ROOT}/_author.yml`]: AUTHORS,
    });
    await renderPanel(ws);
    expect(screen.getByTestId('metadata-panel-byline').textContent).toBe('2 authors');
  });

  it('renders a hairline separator element', async () => {
    const ws = await seededWorkspace({ [`${ROOT}/_frontmatter.yml`]: FRONTMATTER });
    await renderPanel(ws);
    expect(screen.getByTestId('metadata-panel-separator').className).toContain('h-px');
  });

  it('chevron toggle expands and collapses the panel', async () => {
    const ws = await seededWorkspace({ [`${ROOT}/_frontmatter.yml`]: FRONTMATTER });
    await renderPanel(ws);
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
    fireEvent.click(screen.getByTestId('metadata-panel-toggle'));
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
    fireEvent.click(screen.getByTestId('metadata-panel-toggle'));
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
  });
});

describe('MetadataPanel expanded state', () => {
  it('mounts expanded when the title is missing', async () => {
    const ws = await seededWorkspace({ [`${ROOT}/_author.yml`]: AUTHORS });
    await renderPanel(ws);
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
  });

  it('restores the collapsed state after a remount', async () => {
    const ws = await seededWorkspace({});
    const { unmount } = await renderPanel(ws);
    // Empty title starts expanded; collapsing persists for the project.
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
    fireEvent.click(screen.getByTestId('metadata-panel-toggle'));
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
    expect(localStorage.getItem(metadataPanelStorageKey(PROJECT))).toBe('collapsed');
    unmount();
    await renderPanel(ws);
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
  });

  it('collapses on Escape and focuses the editor container', async () => {
    const target = document.createElement('div');
    target.tabIndex = -1;
    document.body.appendChild(target);
    const ws = await seededWorkspace({});
    await renderPanel(ws, { current: target });
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
    fireEvent.keyDown(screen.getByTestId('metadata-panel'), { key: 'Escape' });
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
    expect(document.activeElement).toBe(target);
    target.remove();
  });
});

describe('MetadataPanel editor integration', () => {
  it('renders for a manuscript path and not for opendraft.yml', async () => {
    const ws = await seededWorkspace({
      [`${ROOT}/_frontmatter.yml`]: FRONTMATTER,
      [`${ROOT}/_author.yml`]: AUTHORS,
    });
    const { unmount } = render(
      <ManuscriptEditor
        workspace={ws}
        defaultValue="key: value"
        path="manuscripts/x/blocks/A.qmd"
        mode="source"
        projectId={PROJECT}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('metadata-panel')).toBeDefined());
    expect(
      screen.getByTestId('metadata-panel-byline').textContent,
    ).toContain('Alice Marie Smith, Budi Lee');
    unmount();

    render(
      <ManuscriptEditor
        workspace={ws}
        defaultValue="key: value"
        path="opendraft.yml"
        mode="source"
        projectId={PROJECT}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined());
    expect(screen.queryByTestId('metadata-panel')).toBeNull();
  });
});
