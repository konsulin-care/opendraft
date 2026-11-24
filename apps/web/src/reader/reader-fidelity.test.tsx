// @vitest-environment jsdom
/**
 * Reader fidelity regression guard.
 *
 * Renders the real read-only {@link ManuscriptView} over a memory workspace
 * containing every metadata and block feature the reader must preserve:
 * title, author and keywords, an abstract with KaTeX math, a section heading,
 * a Quarto list table and an inline citation backed by a bib file. The real
 * Crepe editor mounts through the shared block-body harness.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { ManuscriptView } from '../components/ManuscriptView';
import {
  installBlockBodyHarness,
  uninstallBlockBodyHarness,
} from '../block-editor/block-body-harness';

/** Manuscript directory used by the fixture. */
const DIR = 'manuscripts/fidelity';

/** Project key scoping the persisted block-editor state. */
const PROJECT = 'reader-fidelity-test';

/** Assembly including the one rich block under test. */
const ARTICLE = [
  '---',
  'metadata-files:',
  '- _author.yml',
  '---',
  '',
  '{{< include blocks/_results.qmd >}}',
  '',
  '::: {#refs}',
  ':::',
  '',
].join('\n');

/** Block with a section heading, inline citation and Quarto list table. */
const RESULTS = [
  '# Results {#sec-results .deo-section}',
  '',
  'See [@smith2020] for details.',
  '',
  '::: {#tbl-results .list-table}',
  '',
  'Results caption',
  '',
  '- - Head A',
  '  - Head B',
  '',
  '- - Cell A',
  '  - Cell B',
  ':::',
  '',
].join('\n');

/** Bib entry backing the inline citation. */
const BIB = [
  '@article{smith2020,',
  '  author = {Smith, Jane},',
  '  title = {Ocean currents},',
  '  year = {2020},',
  '  journal = {Journal of Tests}',
  '}',
  '',
].join('\n');

/**
 * Seed a memory workspace and render the read-only manuscript view.
 *
 * @returns The rendered container and the workspace the view reads.
 */
async function renderReader(): Promise<{
  container: HTMLElement;
  workspace: MemoryWorkspace;
}> {
  const workspace = new MemoryWorkspace();
  await workspace.writeFile(
    `${DIR}/_frontmatter.yml`,
    'title: "Fidelity Title"\nkeywords: [oceanography, "marine biology"]\n',
  );
  await workspace.writeFile(
    `${DIR}/_author.yml`,
    'authors:\n  - name: Ada Lovelace\n',
  );
  await workspace.writeFile(
    `${DIR}/_abstract.yml`,
    'abstract: "We model $x^2$ growth."\n',
  );
  await workspace.writeFile(`${DIR}/article.qmd`, ARTICLE);
  await workspace.writeFile(`${DIR}/blocks/_results.qmd`, RESULTS);
  // sharedBibPath resolves references.bib one level above the manuscript dir.
  await workspace.writeFile('manuscripts/references.bib', BIB);

  const { container } = render(
    <ManuscriptView
      workspace={workspace}
      dir={DIR}
      projectKey={PROJECT}
      readOnly={true}
    />,
  );
  // Let the richest block finish mounting before a test ends: the
  // uninstall hook removes the fake IntersectionObserver, and an editor
  // still creating its code-block node view would then throw.
  await waitFor(
    () => {
      expect(container.querySelector('.preview-panel table')).not.toBeNull();
    },
    { timeout: 10000 },
  );
  return { container, workspace };
}

beforeEach(installBlockBodyHarness);
afterEach(uninstallBlockBodyHarness);

describe('read-only manuscript fidelity', () => {
  it('renders the title as a heading, the author name and the keywords', async () => {
    await renderReader();

    expect(
      await screen.findByRole('heading', { name: 'Fidelity Title' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(await screen.findByText('oceanography')).toBeInTheDocument();
    expect(await screen.findByText('marine biology')).toBeInTheDocument();
  }, 30000);

  it('renders the abstract math through KaTeX', async () => {
    const { container } = await renderReader();

    await waitFor(
      () => {
        expect(container.querySelector('.katex')).not.toBeNull();
      },
      { timeout: 10000 },
    );
  }, 30000);

  it('renders the section heading, the list-table preview table and the citation text', async () => {
    const { container } = await renderReader();

    expect(
      await screen.findByRole('heading', { name: 'Results' }),
    ).toBeInTheDocument();

    await waitFor(
      () => {
        const table = container.querySelector('.preview-panel table');
        expect(table).not.toBeNull();
        expect(table?.textContent).toContain('Head A');
        expect(table?.textContent).toContain('Cell B');
      },
      { timeout: 10000 },
    );

    await waitFor(
      () => {
        const citation = container.querySelector('[data-citekey="smith2020"]');
        expect(citation).not.toBeNull();
        expect(citation?.textContent).toContain('@smith2020');
      },
      { timeout: 10000 },
    );
  }, 30000);
});
