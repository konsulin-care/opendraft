// @vitest-environment jsdom
/**
 * Manuscript overview tests: the EditorArea overview route rendering one
 * card per manuscripts/<id> folder with its title, author byline and
 * keyword pills at the bottom, the empty-title fallback to a muted folder
 * id that omits the author and keyword rows, and card clicks opening the
 * manuscript directory.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { EditorArea } from './EditorArea';

/** Frontmatter of a titled manuscript with keywords. */
const ALPHA_FRONTMATTER = 'title: Alpha Title\nkeywords:\n  - alpha-one\n  - alpha-two\n';

/** Authors of the alpha manuscript: one structured, one plain-string name. */
const ALPHA_AUTHORS = 'authors:\n  - name:\n      given: Ada\n      family: Lovelace\n  - name: Jane Doe\n';

/** Frontmatter of the beta manuscript. */
const BETA_FRONTMATTER = 'title: Beta Title\nkeywords:\n  - compilers\n';

/** Authors of the beta manuscript. */
const BETA_AUTHORS = 'authors:\n  - name: Grace Hopper\n';

/**
 * Seed a workspace with two titled manuscripts, one untitled manuscript
 * and a root-level file that must not become a card.
 *
 * @returns The seeded workspace.
 */
async function seedWorkspace(): Promise<MemoryWorkspace> {
  const ws = new MemoryWorkspace();
  await ws.writeFile('manuscripts/alpha/article.qmd', '');
  await ws.writeFile('manuscripts/alpha/_frontmatter.yml', ALPHA_FRONTMATTER);
  await ws.writeFile('manuscripts/alpha/_author.yml', ALPHA_AUTHORS);
  await ws.writeFile('manuscripts/beta/article.qmd', '');
  await ws.writeFile('manuscripts/beta/_frontmatter.yml', BETA_FRONTMATTER);
  await ws.writeFile('manuscripts/beta/_author.yml', BETA_AUTHORS);
  await ws.writeFile('manuscripts/plain/_frontmatter.yml', 'title: ""\n');
  await ws.writeFile('manuscripts/plain/_author.yml', 'authors: []\n');
  await ws.writeFile('manuscripts/references.bib', '');
  return ws;
}

/**
 * Render the editor region on the `manuscripts` overview.
 *
 * @param ws - Seeded workspace of the active project.
 * @returns The openFile spy the cards navigate through.
 */
function renderOverview(ws: MemoryWorkspace) {
  const openFile = vi.fn();
  render(
    <EditorArea
      workspace={ws}
      activePath="manuscripts"
      isDir
      file={null}
      projectId="proj-overview"
      onSaveStatusChange={() => {}}
      formattingToolbar={false}
      openFile={openFile}
    />,
  );
  return openFile;
}

/** Wait for every overview card and index them by folder id. */
async function cardsById(): Promise<Map<string, HTMLElement>> {
  const cards = await screen.findAllByTestId('manuscript-card');
  return new Map(cards.map((card) => [card.getAttribute('data-id') ?? '', card]));
}

describe('ManuscriptOverview cards', () => {
  it("renders one card per manuscripts/<id> folder with title, byline and keyword pills at the bottom", async () => {
    renderOverview(await seedWorkspace());
    const cards = await cardsById();
    // Three folders, one card each; the root-level references.bib adds none.
    expect([...cards.keys()]).toEqual(['alpha', 'beta', 'plain']);
    const alpha = cards.get('alpha') as HTMLElement;
    expect(within(alpha).getByTestId('manuscript-card-title')).toHaveTextContent('Alpha Title');
    const byline = within(alpha).getByTestId('manuscript-card-byline');
    expect(byline).toHaveTextContent('Ada Lovelace');
    expect(byline).toHaveTextContent('Jane Doe');
    const keywords = within(alpha).getByTestId('manuscript-card-keywords');
    expect(keywords).toHaveTextContent('alpha-one');
    expect(keywords).toHaveTextContent('alpha-two');
    // The keyword pills sit at the bottom of the card.
    expect(alpha.lastElementChild).toBe(keywords);
    const beta = cards.get('beta') as HTMLElement;
    expect(within(beta).getByTestId('manuscript-card-title')).toHaveTextContent('Beta Title');
    expect(within(beta).getByTestId('manuscript-card-byline')).toHaveTextContent('Grace Hopper');
    expect(within(beta).getByTestId('manuscript-card-keywords')).toHaveTextContent('compilers');
  });

  it('shows the folder id in muted text and omits empty author and keyword rows', async () => {
    renderOverview(await seedWorkspace());
    const plain = (await cardsById()).get('plain') as HTMLElement;
    const idLabel = within(plain).getByText('plain');
    expect(idLabel.className).toContain('text-gray-500');
    expect(within(plain).queryByTestId('manuscript-card-title')).toBeNull();
    expect(within(plain).queryByTestId('manuscript-card-byline')).toBeNull();
    expect(within(plain).queryByTestId('manuscript-card-keywords')).toBeNull();
  });

  it("opens 'manuscripts/<id>' when a card is clicked", async () => {
    const openFile = renderOverview(await seedWorkspace());
    const cards = await cardsById();
    fireEvent.click(cards.get('alpha') as HTMLElement);
    expect(openFile).toHaveBeenCalledWith('manuscripts/alpha');
  });
});
