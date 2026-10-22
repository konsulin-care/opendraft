// @vitest-environment jsdom
/**
 * Authors dialog tests: opening focused on the clicked byline author,
 * the single form with its position indicator (no card list), reorder
 * via the position select, remove with Undo, retained form content
 * (type toggle, fields, degrees, status, on-behalf-of, CRediT,
 * GroupMembers, affiliation section) and a draft author persisted only
 * once it has a name, carrying its buffered affiliation picks and
 * registry entries into the same _author.yml update.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';
import { ArticleView } from './ArticleView';
import { AuthorsDialog } from './AuthorsDialog';
import { useManuscriptMetadata } from './use-manuscript-metadata';

const ROOT = 'manuscripts/x';
const FRONTMATTER = 'title: "Deep Dive"\n';
// Two person authors and one group author: 'Author 2 of 3' opens lee.
const AUTHOR_YML = `# author registry
affiliations:
  - { id: ui, name: University of Indonesia }
  - { id: rscm, name: RS Pondok Indah Cempaka Putih }
authors:
  - id: smith
    name: { given: Alice Marie, family: Smith }
    affiliations: [{ ref: ui }, { ref: rscm }]
    corresponding: true
  - id: lee
    name: { given: Budi, family: Lee }
    affiliations: [{ ref: rscm }]
  - id: dwg
    name: { literal: OpenDraft Team }
`;

/** The article view wired to the manuscript metadata hook. */
function TestPanel({ ws }: { ws: WorkspaceAdapter }) {
  const meta = useManuscriptMetadata(ws, ROOT);
  return <ArticleView title={meta.title} authors={meta.authors} affiliations={meta.affiliations}
    setTitle={meta.setTitle} setAuthors={meta.setAuthors} setAffiliations={meta.setAffiliations}
    setAbstract={meta.setAbstract} abstract={meta.abstract ?? ''} />;
}

/** Seed a memory workspace with the three-author fixture and render it. */
async function boot(): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(`${ROOT}/_frontmatter.yml`, FRONTMATTER);
  await ws.writeFile(`${ROOT}/_author.yml`, AUTHOR_YML);
  render(<TestPanel ws={ws} />);
  await act(async () => {});
  return ws;
}

/** Parsed _author.yml document, its authors list or its registry. */
const readDoc = async (ws: WorkspaceAdapter): Promise<Record<string, unknown>> =>
  parse(await ws.readFile(`${ROOT}/_author.yml`) ?? '') as Record<string, unknown>;
const readAuthors = async (ws: WorkspaceAdapter): Promise<Record<string, unknown>[]> =>
  ((await readDoc(ws)).authors as Record<string, unknown>[] ?? []);
const readAffiliations = async (ws: WorkspaceAdapter): Promise<unknown[]> =>
  ((await readDoc(ws)).affiliations as unknown[] ?? []);

/** Run the 800ms autosave debounce so pending edits hit the file. */
async function flushWrites(): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(800); });
}

/** Simulated viewport width used by the width-aware matchMedia stub. */
let viewportWidth = 1280;
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

/** Install a width-aware `window.matchMedia` stub at the given width. */
function stubMatchMedia(width: number): void {
  viewportWidth = width;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true,
    value: (media: string): MediaQueryList => {
      const max = /\(max-width: (\d+)px\)/.exec(media);
      const min = /\(min-width: (\d+)px\)/.exec(media);
      const matches = max ? viewportWidth <= Number(max[1]) : min ? viewportWidth >= Number(min[1]) : false;
      return { media, matches, onchange: null, addEventListener: () => {}, removeEventListener: () => {},
        addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
    },
  });
}

/** Open the draft form and buffer one manual affiliation entry. */
function draftCreatesAffiliation(name: string): void {
  fireEvent.click(screen.getByTestId('add-author'));
  fireEvent.click(screen.getByTestId('affiliation-create-manual'));
  fireEvent.change(screen.getByTestId('affiliation-manual-name'), { target: { value: name } });
  fireEvent.click(screen.getByTestId('affiliation-manual-save'));
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  vi.useRealTimers();
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
});

describe('AuthorsDialog single form', () => {
  it("opening author 2 of 3 shows one form with 'Author 2 of 3' and no card list", async () => {
    await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    expect(screen.getByTestId('authors-dialog')).toBeDefined(); expect(screen.getByText('Author 2 of 3')).toBeDefined();
    const position = screen.getByTestId('author-position') as HTMLSelectElement;
    expect(position.value).toBe('2');
    expect(screen.getByTestId('author-card-1')).toBeDefined();
    expect((screen.getByTestId('author-given') as HTMLInputElement).value).toBe('Budi');
    expect((screen.getByTestId('author-family') as HTMLInputElement).value).toBe('Lee');
    expect(screen.queryByTestId('author-card-0')).toBeNull();
    expect(screen.queryByTestId('author-card-2')).toBeNull();
    for (const testid of ['author-slot-0', 'author-slot-1', 'author-slot-2', 'author-select-0',
      'author-select-1', 'author-select-2', 'author-move-up-1', 'author-move-down-1'])
      expect(screen.queryByTestId(testid)).toBeNull();
  });

  it("choosing position 1 moves the author to the front of _author.yml", async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    fireEvent.change(screen.getByTestId('author-position'), { target: { value: '1' } });
    expect(screen.getByText('Author 1 of 3')).toBeDefined();
    await flushWrites();
    expect((await readAuthors(ws)).map((author) => author['id'])).toEqual(['lee', 'smith', 'dwg']);
  });

  it('choosing the last position moves the author to the end', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    fireEvent.change(screen.getByTestId('author-position'), { target: { value: '3' } });
    await flushWrites();
    expect((await readAuthors(ws)).map((author) => author['id'])).toEqual(['smith', 'dwg', 'lee']);
  });
});

describe('AuthorsDialog form content', () => {
  it('person form keeps degrees, status, on-behalf-of, CRediT, email and the affiliation section', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    expect(screen.getByTestId('author-affiliation-section')).toBeDefined();
    expect(screen.getByTestId('author-type-person').getAttribute('aria-pressed')).toBe('true');
    const degree = screen.getByTestId('author-degree-field');
    fireEvent.change(degree, { target: { value: 'MD' } }); fireEvent.keyDown(degree, { key: 'Enter' });
    expect(screen.getByTestId('author-degree-chip').textContent).toContain('MD');
    fireEvent.click(screen.getByTestId('author-corresponding'));
    fireEvent.change(screen.getByTestId('author-on-behalf-of'), { target: { value: 'dwg' } });
    fireEvent.click(screen.getByTestId('credit-conceptualization'));
    fireEvent.change(screen.getByTestId('author-email'), { target: { value: 'budi@example.edu' } });
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors[1]).toMatchObject({ degrees: ['MD'], corresponding: true, 'on-behalf-of': 'dwg',
      roles: ['conceptualization'], email: 'budi@example.edu' });
  });

  it('Person/Group toggle switches the form to GroupMembers and back', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    fireEvent.click(screen.getByTestId('author-type-group'));
    expect((screen.getByTestId('author-group-name') as HTMLInputElement).value).toBe('Budi Lee');
    expect(screen.getByTestId('group-members')).toBeDefined();
    expect(screen.queryByTestId('author-affiliation-section')).toBeNull();
    fireEvent.click(screen.getByTestId('author-type-person')); expect(screen.queryByTestId('group-members')).toBeNull();
    expect((screen.getByTestId('author-family') as HTMLInputElement).value).toBe('Budi Lee');
    await flushWrites();
    expect((await readAuthors(ws))[1]['name']).toEqual({ family: 'Budi Lee' });
  });

  it('group author form shows the group name and GroupMembers without an affiliation section', async () => {
    await boot();
    fireEvent.click(screen.getByTestId('byline-author-2'));
    expect(screen.getByText('Author 3 of 3')).toBeDefined();
    expect((screen.getByTestId('author-group-name') as HTMLInputElement).value).toBe('OpenDraft Team');
    expect(screen.getByTestId('group-members')).toBeDefined(); expect(screen.queryByTestId('author-affiliation-section')).toBeNull();
  });
});

describe('AuthorsDialog remove and undo', () => {
  it('Remove then Undo restores the author', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    fireEvent.click(screen.getByTestId('author-remove-1'));
    expect(screen.getByTestId('article-byline').textContent).not.toContain('Budi Lee');
    expect(screen.getByText('Author 2 of 2')).toBeDefined();
    fireEvent.click(screen.getByTestId('author-undo'));
    expect(screen.getByTestId('article-byline').textContent).toContain('Budi Lee');
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors).toHaveLength(3); expect(authors[1]['id']).toBe('lee');
  });

  it('removing an author prunes unreferenced registry entries and Undo restores them', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('byline-author-0'));
    fireEvent.click(screen.getByTestId('author-remove-0'));
    await flushWrites();
    expect((await readAffiliations(ws)).map((a) => (a as Record<string, unknown>)['id'])).toEqual(['rscm']);
    fireEvent.click(screen.getByTestId('author-undo'));
    await flushWrites();
    expect((await readAuthors(ws)).map((a) => a['id'])).toEqual(['smith', 'lee', 'dwg']);
    expect((await readAffiliations(ws)).map((a) => (a as Record<string, unknown>)['id'])).toEqual(['ui', 'rscm']);
  });
});

describe('AuthorsDialog draft author', () => {
  it('Add author leaves _author.yml unchanged until a family name is typed', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('add-author'));
    expect(document.activeElement).toBe(screen.getByTestId('author-orcid'));
    fireEvent.change(screen.getByTestId('author-given'), { target: { value: 'Dewi' } });
    await flushWrites();
    expect(await readAuthors(ws)).toHaveLength(3);
    fireEvent.change(screen.getByTestId('author-family'), { target: { value: 'Sari' } });
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors).toHaveLength(4); expect(authors[3]).toMatchObject({ name: { given: 'Dewi', family: 'Sari' } });
  });

  it('stores a single draft name as a literal person with author-type metadata', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('add-author'));
    fireEvent.click(screen.getByTestId('author-single-name'));
    expect(screen.queryByTestId('author-given')).toBeNull(); expect(screen.getByPlaceholderText('Name')).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Dewi' } });
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors).toHaveLength(4); expect(authors[3]).toMatchObject({ name: { literal: 'Dewi' }, metadata: { 'author-type': 'person' } });
  });
});

describe('AuthorsDialog draft affiliations', () => {
  it('persists buffered draft affiliations with the newly named author in one write', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('add-author'));
    expect(screen.getByTestId('affiliation-search')).toBeDefined();
    expect(screen.getByTestId('author-affiliation-section')).toBeDefined();
    await draftCreatesAffiliation('Gadjah Mada University');
    fireEvent.change(screen.getByTestId('author-family'), { target: { value: 'Sari' } });
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors).toHaveLength(4);
    expect(authors[3]).toMatchObject({ name: { given: '', family: 'Sari' }, affiliations: [{ ref: 'gadjah-mada-university' }] });
    expect(await readAffiliations(ws)).toContainEqual(expect.objectContaining({ id: 'gadjah-mada-university' }));
  });

  it('abandons a draft with buffered picks without touching _author.yml', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('add-author'));
    await draftCreatesAffiliation('Gadjah Mada University');
    fireEvent.change(screen.getByTestId('affiliation-search'), { target: { value: 'univ' } });
    fireEvent.click(screen.getByTestId('affiliation-registry-item-0'));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('authors-dialog')).toBeNull();
    await flushWrites();
    expect(await readAuthors(ws)).toHaveLength(3); expect(await readAffiliations(ws)).toHaveLength(2);
  });
});

describe('AuthorsDialog draft setter calls', () => {
  it('buffers picks without calling setters; the family name persists author and registry together', () => {
    const setAuthors = vi.fn();
    const setAffiliations = vi.fn();
    render(<AuthorsDialog authors={[]} setAuthors={setAuthors} affiliations={[]}
      setAffiliations={setAffiliations} startWithDraft onClose={vi.fn()} />);
    expect(screen.getByTestId('affiliation-search')).toBeDefined();
    fireEvent.click(screen.getByTestId('affiliation-create-manual'));
    fireEvent.change(screen.getByTestId('affiliation-manual-name'), { target: { value: 'Gadjah Mada University' } });
    fireEvent.click(screen.getByTestId('affiliation-manual-save'));
    expect(setAuthors).not.toHaveBeenCalled(); expect(setAffiliations).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('author-family'), { target: { value: 'Sari' } });
    expect(setAuthors).toHaveBeenCalledTimes(1); expect(setAffiliations).toHaveBeenCalledTimes(1);
    expect(setAuthors.mock.calls[0]?.[0]).toEqual([{ id: 'sari', name: { given: '', family: 'Sari' }, affiliations: [{ ref: 'gadjah-mada-university' }] }]);
    expect(setAffiliations.mock.calls[0]?.[0]).toEqual([{ id: 'gadjah-mada-university', name: 'Gadjah Mada University' }]);
  });
});

describe('AuthorsDialog viewport handling', () => {
  it('renders a full-screen role=dialog sheet with the single form at 375px', async () => {
    stubMatchMedia(375);
    await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    const dialog = screen.getByTestId('authors-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog'); expect(dialog.className).toContain('fixed inset-0');
    expect(screen.getByText('Author 2 of 3')).toBeDefined();
    expect(screen.queryByTestId('authors-back')).toBeNull(); expect(screen.queryByTestId('author-select-0')).toBeNull();
  });

  it('renders a centered dialog with the single form at 800px', async () => {
    stubMatchMedia(800);
    await boot();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    const dialog = screen.getByTestId('authors-dialog');
    expect(dialog.className).not.toContain('fixed inset-0'); expect(dialog.parentElement?.className).toContain('justify-center');
    expect(screen.getByTestId('author-card-1')).toBeDefined(); expect(screen.queryByTestId('author-card-0')).toBeNull();
    expect(screen.queryByTestId('author-select-0')).toBeNull();
  });
});
