// @vitest-environment jsdom
/**
 * Validation badge tests: publish-profile driven counts, the expand-on-
 * click issue list, the issue-selection focus flow (single-form
 * authors dialog with the affiliation picker focused) and the hidden
 * empty state.
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { MetadataPanel } from './MetadataPanel';

const ROOT = 'manuscripts/x';
const PROJECT = 'proj-d12';

const TITLED = 'title: "Deep Dive"\n';
const LICENSED = 'title: "Deep Dive"\nlicense: CC BY 4.0\n';
const ABSTRACT = 'abstract: "Some text."\n';
// One person author without an affiliation; no license in the frontmatter.
const AUTHORS_NO_AFFILIATION = `authors:
  - id: smith
    name:
      given: Alice Marie
      family: Smith
    email: alice@example.edu
    corresponding: true
`;
// Valid author list: registry entry, resolving ref, corresponding email.
const AUTHORS_VALID = `affiliations:
  - id: ui
    name: University of Indonesia
authors:
  - id: smith
    name:
      given: Alice Marie
      family: Smith
    email: alice@example.edu
    corresponding: true
    affiliations:
      - ref: ui
`;

/** Fixture with one publish issue (missing affiliation) and one warning. */
const ISSUE_FILES: Record<string, string> = {
  [`${ROOT}/_frontmatter.yml`]: TITLED,
  [`${ROOT}/_abstract.yml`]: ABSTRACT,
  [`${ROOT}/_author.yml`]: AUTHORS_NO_AFFILIATION,
};

/** Original `window.matchMedia` descriptor restored after each test. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

/** Stub `window.matchMedia`; no viewport query matches. */
function stubViewport(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
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
 * Seed a memory workspace and render the metadata panel for the root.
 *
 * @param files - Manuscript files keyed by repo-relative path.
 * @returns The render result.
 */
async function renderPanel(files: Record<string, string>) {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(files)) await ws.writeFile(path, content);
  const rendered = render(
    <MetadataPanel workspace={ws} manuscriptRoot={ROOT} projectKey={PROJECT} />,
  );
  await waitFor(() => expect(screen.getByTestId('metadata-panel')).toBeDefined());
  return rendered;
}

beforeEach(() => {
  localStorage.clear();
  stubViewport();
});

afterEach(() => {
  localStorage.clear();
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
});

it("badge reads '1 to publish' with one person missing an affiliation and no license", async () => {
  await renderPanel(ISSUE_FILES);
  expect(screen.getByTestId('validation-badge').textContent).toBe('1 to publish');
});

it('clicking the badge expands the panel and lists the issues', async () => {
  await renderPanel(ISSUE_FILES);
  fireEvent.click(screen.getByTestId('validation-badge'));
  expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
  const messages = screen.getAllByTestId('validation-issue').map((el) => el.textContent ?? '');
  expect(messages).toContain('person author has no affiliation');
  expect(messages).toContain('missing license');
});

it('selecting the affiliation issue opens the matching author form with the picker focused', async () => {
  await renderPanel(ISSUE_FILES);
  fireEvent.click(screen.getByTestId('validation-badge'));
  const issue = screen.getAllByTestId('validation-issue')
    .find((el) => (el.textContent ?? '').includes('no affiliation'));
  expect(issue).toBeDefined();
  if (issue) fireEvent.click(issue);
  expect(screen.getByTestId('authors-dialog')).toBeDefined();
  expect(screen.getByTestId('author-position-header').textContent).toMatch(/^Author order:.*of 1$/);
  expect(screen.getByTestId('author-card-0')).toBeDefined();
  expect(screen.queryByTestId('author-select-0')).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('affiliation-search')));
});

it('shows commit issues as a "{m} to commit" segment', async () => {
  await renderPanel({
    [`${ROOT}/_frontmatter.yml`]: 'custom: 1\n',
    [`${ROOT}/_abstract.yml`]: ABSTRACT,
    [`${ROOT}/_author.yml`]: AUTHORS_VALID,
  });
  expect(screen.getByTestId('validation-badge').textContent).toBe('1 to commit');
});

it('is hidden when there are no issues', async () => {
  await renderPanel({
    [`${ROOT}/_frontmatter.yml`]: LICENSED,
    [`${ROOT}/_abstract.yml`]: ABSTRACT,
    [`${ROOT}/_author.yml`]: AUTHORS_VALID,
  });
  expect(screen.queryByTestId('validation-badge')).toBeNull();
});
