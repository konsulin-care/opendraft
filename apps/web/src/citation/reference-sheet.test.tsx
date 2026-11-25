// @vitest-environment jsdom
/**
 * ReferenceSheet tests: the sheet is titled with the citekey, shows the
 * APA reference body and offers an Open link action only when the
 * reference resolves to a DOI or URL.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Reference } from '@opendraft/references';
import { ReferenceSheet, showReferenceSheet, hideReferenceSheet } from './reference-sheet';

/** Reference with a DOI. */
const DOI_REF: Reference = {
  citeKey: 'smith2024',
  entryType: 'article',
  fields: {
    author: 'Smith, John',
    year: '2024',
    title: 'A Test Article',
    journal: 'Test Journal',
    volume: '10',
    number: '2',
    pages: '100-120',
    doi: '10.1000/test',
  },
};

/** Reference with only a URL field. */
const URL_REF: Reference = {
  citeKey: 'doe2023',
  entryType: 'misc',
  fields: {
    author: 'Doe, Jane',
    year: '2023',
    title: 'Web Resource',
    url: 'https://example.org/resource',
  },
};

/** Reference without a DOI or URL. */
const BARE_REF: Reference = {
  citeKey: 'bare2020',
  entryType: 'misc',
  fields: {
    author: 'Roe, Richard',
    year: '2020',
    title: 'Unlinked Work',
  },
};

afterEach(() => {
  cleanup();
  hideReferenceSheet();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('ReferenceSheet', () => {
  it('shows the citekey title and the APA reference details', () => {
    render(<ReferenceSheet reference={DOI_REF} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'smith2024' })).toBeTruthy();
    expect(screen.getByText(/Smith, J\./)).toBeTruthy();
    expect(screen.getByText(/A test article/)).toBeTruthy();
  });

  it('opens the reference DOI in a new tab and closes the sheet', () => {
    const onClose = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ReferenceSheet reference={DOI_REF} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('bottom-sheet-action'));
    expect(openSpy).toHaveBeenCalledWith(
      'https://doi.org/10.1000/test',
      '_blank',
      'noopener,noreferrer',
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the reference URL when no DOI is present', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ReferenceSheet reference={URL_REF} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('bottom-sheet-action'));
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.org/resource',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('renders no footer button for a reference without DOI or URL', () => {
    render(<ReferenceSheet reference={BARE_REF} onClose={vi.fn()} />);
    expect(screen.queryByTestId('bottom-sheet-action')).toBeNull();
  });
});

describe('showReferenceSheet / hideReferenceSheet', () => {
  it('mounts the sheet into the body and unmounts it on hide', () => {
    act(() => {
      showReferenceSheet(DOI_REF);
    });
    expect(screen.getByRole('heading', { name: 'smith2024' })).toBeTruthy();
    expect(document.querySelector('.reference-sheet-container')).not.toBeNull();

    act(() => {
      hideReferenceSheet();
    });
    expect(document.querySelector('.reference-sheet-container')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'smith2024' })).toBeNull();
  });
});
