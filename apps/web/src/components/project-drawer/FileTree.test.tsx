import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { FileTree } from './FileTree';
import type { FileTreeProps } from './FileTree';

// @vitest-environment jsdom

/** Sample working-directory paths for the tree under test. */
const PATHS = [
  'opendraft.yml',
  'manuscripts/p/article.qmd',
  'manuscripts/p/refs.bib',
  'manuscripts/p/fig.png',
];

/** Path of the file rendered as active in the default tree. */
const ACTIVE = 'manuscripts/p/article.qmd';

/**
 * Create a workspace holding the sample files. fig.png holds binary
 * content; every other file gets plain text.
 *
 * @param extra - Additional plain-text paths to include.
 * @returns A MemoryWorkspace with the sample project files.
 */
async function makeWorkspace(extra: string[] = []): Promise<MemoryWorkspace> {
  const ws = new MemoryWorkspace();
  for (const path of PATHS) {
    const content =
      path === 'manuscripts/p/fig.png' ? '\u0000\u0000\u0000PNG' : `content of ${path}`;
    await ws.writeFile(path, content);
  }
  for (const path of extra) {
    await ws.writeFile(path, 'manifest');
  }
  return ws;
}

/**
 * Render {@link FileTree} over the sample paths.
 *
 * @param overrides - Props to replace in the default configuration.
 * @returns The onOpen spy passed to the tree.
 */
async function renderTree(overrides: Partial<FileTreeProps> = {}): Promise<{
  /** Spy asserted for file-open calls. */
  onOpen: (path: string) => void;
}> {
  const onOpen = overrides.onOpen ?? vi.fn<(path: string) => void>();
  const workspace = overrides.workspace ?? (await makeWorkspace());
  render(
    <FileTree
      paths={overrides.paths ?? PATHS}
      workspace={workspace}
      activePath={overrides.activePath !== undefined ? overrides.activePath : ACTIVE}
      onOpen={onOpen}
    />,
  );
  return { onOpen };
}

/**
 * Wait until binary classification has completed for fig.png.
 */
async function waitForBinaryClassification(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole('treeitem', { name: 'fig.png' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });
}

describe('FileTree structure', () => {
  it('renders folders before files, alphabetically', async () => {
    await renderTree();

    const items = within(screen.getByRole('tree')).getAllByRole('treeitem');
    expect(items.map((el) => el.textContent)).toEqual([
      'manuscripts',
      'p',
      'article.qmd',
      'fig.png',
      'refs.bib',
      'opendraft.yml',
    ]);
  });

  it('expands ancestor folders and marks the active file selected', async () => {
    await renderTree();

    expect(screen.getByRole('treeitem', { name: 'manuscripts' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(screen.getByRole('treeitem', { name: 'p' }).getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByRole('treeitem', { name: 'article.qmd' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('opens a file on click', async () => {
    const { onOpen } = await renderTree();

    fireEvent.click(screen.getByRole('treeitem', { name: 'refs.bib' }));
    expect(onOpen).toHaveBeenCalledWith('manuscripts/p/refs.bib');
  });
});

describe('FileTree interaction', () => {
  it('marks binary files disabled and refuses to open them', async () => {
    const { onOpen } = await renderTree();
    await waitForBinaryClassification();

    const png = screen.getByRole('treeitem', { name: 'fig.png' });
    expect(png.getAttribute('title')).toBe('Binary files are not supported');

    fireEvent.click(png);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('moves focus with arrow keys and opens the focused file with Enter', async () => {
    const { onOpen } = await renderTree();
    await waitForBinaryClassification();
    const tree = screen.getByRole('tree');

    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect((document.activeElement as HTMLElement).textContent).toBe('fig.png');
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect((document.activeElement as HTMLElement).textContent).toBe('refs.bib');
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('manuscripts/p/refs.bib');

    fireEvent.keyDown(tree, { key: 'ArrowUp' });
    expect((document.activeElement as HTMLElement).textContent).toBe('fig.png');
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('shows a derived badge when the article has a blocks manifest', async () => {
    await renderTree({ paths: [...PATHS, 'manuscripts/p/blocks/manifest.json'] });

    const article = screen.getByText('article.qmd').closest('[role="treeitem"]');
    expect(article).not.toBeNull();
    expect(within(article as HTMLElement).getByText('derived')).toBeDefined();
  });
});
