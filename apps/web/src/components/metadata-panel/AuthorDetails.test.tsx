// @vitest-environment jsdom
/**
 * AuthorDetails and AuthorTooltip tests: part order (email, ORCID link,
 * numbered affiliations, roles), omission of absent parts and the
 * tooltip wrapper around the shared details block.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BylineAuthor } from './byline-model';
import { AuthorDetails, AuthorTooltip } from './AuthorDetails';

/** Fully populated byline author fixture. */
const FULL: BylineAuthor = {
  key: 'smith',
  name: 'Alice Smith',
  superscript: '1,2',
  corresponding: true,
  equal: false,
  deceased: false,
  orcid: '0000-0002-1825-0097',
  email: 'alice@example.edu',
  roles: ['conceptualization', 'writing-original-draft'],
  affiliations: [
    { id: 'ui', number: 1, name: 'University of Indonesia' },
    { id: 'rscm', number: 2, name: 'RS Pondok Indah' },
  ],
  group: false,
  members: [],
};

/** Author with no optional details at all. */
const BARE: BylineAuthor = {
  key: 'doe',
  name: 'Jane Doe',
  superscript: '',
  corresponding: false,
  equal: false,
  deceased: false,
  roles: [],
  affiliations: [],
  group: false,
  members: [],
};

describe('AuthorDetails', () => {
  it('renders email, ORCID link, affiliations and roles in order', () => {
    render(<AuthorDetails author={FULL} />);
    const container = screen.getByTestId('author-details');
    expect(container.className).toContain('space-y-3');
    expect(screen.getByTestId('author-details-email').textContent).toBe('alice@example.edu');

    const orcid = screen.getByTestId('author-details-orcid');
    const link = orcid.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://orcid.org/0000-0002-1825-0097');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');

    expect(screen.getByTestId('author-details-affiliations').textContent).toBe(
      '1. University of Indonesia2. RS Pondok Indah',
    );
    expect(screen.getByTestId('author-details-roles').textContent).toBe(
      'Roles: Conceptualization, Writing – original draft',
    );

    const order = Array.from(container.children).map((child) => child.getAttribute('data-testid'));
    expect(order).toEqual([
      'author-details-email',
      'author-details-orcid',
      'author-details-affiliations',
      'author-details-roles',
    ]);
  });

  it('omits absent parts', () => {
    render(<AuthorDetails author={BARE} />);
    expect(screen.queryByTestId('author-details-email')).toBeNull();
    expect(screen.queryByTestId('author-details-orcid')).toBeNull();
    expect(screen.queryByTestId('author-details-affiliations')).toBeNull();
    expect(screen.queryByTestId('author-details-roles')).toBeNull();
  });
});

describe('AuthorTooltip', () => {
  it('wraps the details in a tooltip with the given id', () => {
    render(<AuthorTooltip author={FULL} id="tip-1" />);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.getAttribute('id')).toBe('tip-1');
    expect(tooltip.className).toContain('absolute');
    expect(tooltip.className).toContain('w-64');
    expect(screen.getByTestId('author-details')).not.toBeNull();
    expect(screen.getByTestId('author-details-email').textContent).toBe('alice@example.edu');
  });
});
