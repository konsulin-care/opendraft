// @vitest-environment jsdom
/**
 * Manuscript index tests: one card per declared manuscript with title,
 * authors and abstract, each linking to the current reader path plus
 * `?manuscript=<id>` while keeping the `/tree/<ref>` suffix.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { ManuscriptIndex, manuscriptHref } from './ManuscriptIndex';
import type { ManuscriptEntry } from './load-repo';

/** Full abstract that must be truncated on a card. */
const LONG_ABSTRACT = `${'Long abstract sentence. '.repeat(20)}Final sentence.`;

/**
 * Seed a workspace with two manuscripts, one of them without metadata.
 *
 * @returns The seeded workspace.
 */
async function seedWorkspace(): Promise<MemoryWorkspace> {
  const ws = new MemoryWorkspace();
  await ws.writeFile('manuscripts/alpha/_frontmatter.yml', 'title: Alpha Title\n');
  await ws.writeFile(
    'manuscripts/alpha/_author.yml',
    'authors:\n  - name:\n      given: Ada\n      family: Lovelace\n  - name: Jane Doe\n',
  );
  await ws.writeFile('manuscripts/alpha/_abstract.yml', `abstract: ${JSON.stringify(LONG_ABSTRACT)}\n`);
  await ws.writeFile('manuscripts/beta/article.qmd', '');
  return ws;
}

/** Manuscripts declared for the fixture repository. */
const MANUSCRIPTS: ManuscriptEntry[] = [
  { id: 'alpha', path: 'manuscripts/alpha' },
  { id: 'beta', path: 'manuscripts/beta' },
];

describe('ManuscriptIndex cards', () => {
  it('renders one card per manuscript with title, authors and abstract', async () => {
    render(
      <ManuscriptIndex
        workspace={await seedWorkspace()}
        manuscripts={MANUSCRIPTS}
        route={{ owner: 'o', repo: 'r', ref: 'feature/x' }}
      />,
    );

    const cards = await screen.findAllByTestId('manuscript-card');
    expect(cards).toHaveLength(2);

    const alpha = cards.find((card) => card.getAttribute('data-id') === 'alpha') as HTMLElement;
    expect(alpha).toBeDefined();
    expect(alpha.querySelector('[data-testid="manuscript-card-title"]')).toHaveTextContent(
      'Alpha Title',
    );
    expect(alpha.querySelector('[data-testid="manuscript-card-authors"]')).toHaveTextContent(
      'Ada Lovelace',
    );
    expect(alpha.querySelector('[data-testid="manuscript-card-authors"]')).toHaveTextContent(
      'Jane Doe',
    );
    const abstract = alpha.querySelector('[data-testid="manuscript-card-abstract"]');
    expect(abstract).not.toBeNull();
    expect(abstract?.textContent).toContain('Long abstract sentence.');
    expect(abstract?.textContent).toContain('…');
    expect(abstract?.textContent?.length).toBeLessThan(LONG_ABSTRACT.length);

    const beta = cards.find((card) => card.getAttribute('data-id') === 'beta') as HTMLElement;
    expect(beta.querySelector('[data-testid="manuscript-card-title"]')).toHaveTextContent('beta');
    expect(beta.querySelector('[data-testid="manuscript-card-authors"]')).toBeNull();
    expect(beta.querySelector('[data-testid="manuscript-card-abstract"]')).toBeNull();
  });
});

describe('ManuscriptIndex links', () => {
  it('links each card to the current path with ?manuscript=<id>', async () => {
    render(
      <ManuscriptIndex
        workspace={await seedWorkspace()}
        manuscripts={MANUSCRIPTS}
        route={{ owner: 'o', repo: 'r', ref: 'feature/x' }}
      />,
    );

    const cards = await screen.findAllByTestId('manuscript-card');
    const alpha = cards.find((card) => card.getAttribute('data-id') === 'alpha') as HTMLElement;
    const beta = cards.find((card) => card.getAttribute('data-id') === 'beta') as HTMLElement;
    expect(alpha.getAttribute('href')).toBe('/o/r/tree/feature/x?manuscript=alpha');
    expect(beta.getAttribute('href')).toBe('/o/r/tree/feature/x?manuscript=beta');
  });
});

describe('manuscriptHref', () => {
  it('builds hrefs without a tree suffix and encodes the manuscript id', () => {
    expect(manuscriptHref({ owner: 'o', repo: 'r' }, 'alpha')).toBe('/o/r?manuscript=alpha');
    expect(manuscriptHref({ owner: 'o', repo: 'r', ref: 'main' }, 'beta one')).toBe(
      '/o/r/tree/main?manuscript=beta%20one',
    );
  });
});
