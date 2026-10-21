// @vitest-environment jsdom
/**
 * Authors dialog tests: opening focused on the clicked byline author,
 * ordered cards, reorder via the up/down buttons and drag, remove with
 * Undo, and a draft author persisted only once it has a name.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';
import { ArticleView } from './ArticleView';
import { useManuscriptMetadata } from './use-manuscript-metadata';

const ROOT = 'manuscripts/x';
const FRONTMATTER = 'title: "Deep Dive"\n';
const AUTHOR_YML = `# author registry
affiliations:
  - id: ui
    name: University of Indonesia
  - id: rscm
    name: RS Pondok Indah Cempaka Putih
authors:
  - id: smith
    name:
      given: Alice Marie
      family: Smith
    affiliations:
      - ref: ui
      - ref: rscm
    corresponding: true
  - id: lee
    name:
      given: Budi
      family: Lee
    affiliations:
      - ref: rscm
`;

/** The article view wired to the manuscript metadata hook. */
function TestPanel({ ws }: { ws: WorkspaceAdapter }) {
  const meta = useManuscriptMetadata(ws, ROOT);
  return (
    <ArticleView
      title={meta.title}
      authors={meta.authors}
      setTitle={meta.setTitle}
      setAuthors={meta.setAuthors}
      setAbstract={meta.setAbstract}
      abstract={meta.abstract ?? ''}
    />
  );
}

/** Seed a memory workspace with the two-author fixture and render it. */
async function boot(): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(`${ROOT}/_frontmatter.yml`, FRONTMATTER);
  await ws.writeFile(`${ROOT}/_author.yml`, AUTHOR_YML);
  render(<TestPanel ws={ws} />);
  await act(async () => {});
  return ws;
}

/** Parsed authors currently written to _author.yml. */
async function readAuthors(ws: WorkspaceAdapter): Promise<Record<string, unknown>[]> {
  const text = await ws.readFile(`${ROOT}/_author.yml`);
  return ((parse(text ?? '') as { authors?: Record<string, unknown>[] }).authors) ?? [];
}

/** Run the 800ms autosave debounce so pending edits hit the file. */
async function flushWrites(): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(800); });
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('AuthorsDialog opening', () => {
  it("clicking 'Budi Lee' in the byline opens the dialog with Budi's card expanded", async () => {
    await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    expect(screen.getByTestId('authors-dialog')).toBeDefined();
    expect(screen.getByTestId('author-card-1').textContent).toContain('Budi Lee');
    expect(screen.queryByTestId('author-card-0')).toBeNull();
    expect(screen.getByTestId('author-select-0').textContent).toContain('Alice Marie Smith');
  });
});

describe('AuthorsDialog reorder', () => {
  it("'Move up' on card 2 swaps the order in the written YAML", async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    fireEvent.click(screen.getByTestId('author-move-up-1'));
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors.map((author) => author['id'])).toEqual(['lee', 'smith']);
  });

  it('dragging card 2 onto card 1 reorders the written YAML', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    fireEvent.dragStart(screen.getByTestId('author-slot-1'));
    fireEvent.dragOver(screen.getByTestId('author-slot-0'));
    fireEvent.drop(screen.getByTestId('author-slot-0'));
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors.map((author) => author['id'])).toEqual(['lee', 'smith']);
  });
});

describe('AuthorsDialog remove and undo', () => {
  it('Remove then Undo restores the author', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    fireEvent.click(screen.getByTestId('author-remove-1'));
    expect(screen.queryByTestId('byline-author-1')).toBeNull();
    fireEvent.click(screen.getByTestId('author-undo'));
    expect(screen.getByTestId('byline-author-1').textContent).toContain('Budi Lee');
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors).toHaveLength(2);
    expect(authors[1]['id']).toBe('lee');
  });
});

describe('AuthorsDialog draft author', () => {
  it('Add author leaves _author.yml unchanged until a family name is typed', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('add-author'));
    expect(document.activeElement).toBe(screen.getByTestId('author-orcid'));
    fireEvent.change(screen.getByTestId('author-given'), { target: { value: 'Dewi' } });
    await flushWrites();
    expect(await readAuthors(ws)).toHaveLength(2);
    fireEvent.change(screen.getByTestId('author-family'), { target: { value: 'Sari' } });
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors).toHaveLength(3);
    expect(authors[2]).toMatchObject({ name: { given: 'Dewi', family: 'Sari' } });
  });

  it("'only one name' hides Given name and stores {family:'Dewi'}", async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('add-author'));
    fireEvent.click(screen.getByTestId('author-single-name'));
    expect(screen.queryByTestId('author-given')).toBeNull();
    fireEvent.change(screen.getByTestId('author-family'), { target: { value: 'Dewi' } });
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors[2]['name']).toEqual({ family: 'Dewi' });
  });
});
