// @vitest-environment jsdom
/**
 * ReaderMetadata tests: the read-only metadata block of the reader renders
 * the title, author names, abstract and keywords from the manuscript
 * metadata files, and exposes no editing affordance.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { ReaderMetadata } from './ReaderMetadata';

/** Manuscript root used by every fixture. */
const ROOT = 'manuscripts/demo';

/**
 * Render the metadata block over a freshly seeded workspace.
 *
 * @param files - Repo-relative paths mapped to file contents.
 * @returns The rendered container element.
 */
async function renderMetadata(files: Record<string, string>): Promise<HTMLElement> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(files)) await ws.writeFile(path, content);
  return render(<ReaderMetadata workspace={ws} manuscriptRoot={ROOT} />).container;
}

describe('ReaderMetadata', () => {
  it('renders the title, author names, abstract and keywords from the metadata files', async () => {
    await renderMetadata({
      [`${ROOT}/_frontmatter.yml`]:
        'title: "Deep Dive"\nkeywords:\n  - ocean\n  - "marine biology"\n',
      [`${ROOT}/_author.yml`]:
        'authors:\n  - name: Ada Lovelace\n  - name:\n      given: Alice Marie\n      family: Smith\n  - name:\n      literal: The Consortium\n',
      [`${ROOT}/_abstract.yml`]: 'abstract: "A study of the deep sea."\n',
    });

    expect(await screen.findByRole('heading', { name: 'Deep Dive' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Alice Marie Smith')).toBeInTheDocument();
    expect(screen.getByText('The Consortium')).toBeInTheDocument();
    expect(screen.getByText('A study of the deep sea.')).toBeInTheDocument();
    expect(screen.getByText('ocean')).toBeInTheDocument();
    expect(screen.getByText('marine biology')).toBeInTheDocument();
  });

  it('renders no input, textarea, button or contenteditable element', async () => {
    const container = await renderMetadata({
      [`${ROOT}/_frontmatter.yml`]: 'title: "Deep Dive"\nkeywords: [ocean]\n',
      [`${ROOT}/_author.yml`]: 'authors:\n  - name: Ada Lovelace\n',
      [`${ROOT}/_abstract.yml`]: 'abstract: "A study of the deep sea."\n',
    });

    await screen.findByRole('heading', { name: 'Deep Dive' });
    expect(container.querySelectorAll('input, textarea, button, [contenteditable]'))
      .toHaveLength(0);
    expect(container.querySelectorAll('[contenteditable="true"], [contenteditable=""]'))
      .toHaveLength(0);
  });
});
