// @vitest-environment jsdom
/**
 * ReaderByline tests: the reader byline renders author name buttons with
 * affiliation superscripts and symbol footnotes but no numbered
 * affiliation list, shows the shared author tooltip on mouse hover/focus
 * and opens the touch author sheet without an Edit action.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { buildByline } from '../components/metadata-panel/byline-model';
import type { AffiliationEntry } from '../components/metadata-panel/byline-model';
import type { MetadataAuthor } from '../components/metadata-panel/use-manuscript-metadata';
import { ReaderByline } from './ReaderByline';

/** Author fixture with every detail part rendered by the tooltip. */
const AUTHOR: MetadataAuthor = {
  id: 'ada',
  name: 'Ada Lovelace',
  email: 'ada@example.edu',
  orcid: '0000-0002-1825-0097',
  roles: ['conceptualization'],
  affiliations: [{ ref: 'london' }],
  corresponding: true,
};

/** Affiliation registry used by the fixture. */
const AFFILIATIONS: AffiliationEntry[] = [
  { id: 'london', name: 'University of London' },
];

/** Render the byline of the fixture author. */
function renderByline(): void {
  render(<ReaderByline model={buildByline([AUTHOR], AFFILIATIONS)} />);
}

/** Dispatch a pointerdown carrying a pointerType, which jsdom events lack by default. */
function pointerDown(element: HTMLElement, pointerType: string): void {
  const event = new Event('pointerdown', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  fireEvent(element, event);
}

/** Simulate a touch tap: pointerdown with pointerType touch, then click. */
function touchTap(element: HTMLElement): void {
  pointerDown(element, 'touch');
  fireEvent.focus(element);
  fireEvent.mouseEnter(element);
  fireEvent.click(element);
}

afterEach(() => {
  cleanup();
});

describe('ReaderByline', () => {
  it('renders no affiliation list while keeping superscripts and footnotes', () => {
    renderByline();

    expect(screen.queryByTestId('reader-affiliation-list')).toBeNull();
    expect(screen.getByTestId('reader-byline-superscript-0')).toHaveTextContent('1*');
    expect(screen.getByTestId('reader-byline-footnotes'))
      .toHaveTextContent('* Corresponding author');
  });

  it('shows email, ORCID link, numbered affiliations and roles on hover or focus', () => {
    renderByline();
    const author = screen.getByTestId('reader-byline-author-0');

    pointerDown(author, 'mouse');
    fireEvent.mouseEnter(author);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('author-details-email')).toHaveTextContent('ada@example.edu');
    expect(screen.getByTestId('author-details-orcid').querySelector('a'))
      .toHaveAttribute('href', 'https://orcid.org/0000-0002-1825-0097');
    expect(screen.getByTestId('author-details-affiliations'))
      .toHaveTextContent('1. University of London');
    expect(screen.getByTestId('author-details-roles'))
      .toHaveTextContent('Roles: Conceptualization');
  });

  it('opens the author sheet without a footer action on a touch tap', () => {
    renderByline();

    touchTap(screen.getByTestId('reader-byline-author-0'));

    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('author-details-email')).toHaveTextContent('ada@example.edu');
    expect(screen.queryByTestId('bottom-sheet-action')).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
