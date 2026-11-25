// @vitest-environment jsdom
/**
 * AuthorSheet tests: the sheet is titled with the author name, shows the
 * shared AuthorDetails body and only renders an Edit footer action when
 * an onEdit handler is supplied.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { BylineAuthor } from './byline-model';
import { AuthorSheet } from './AuthorSheet';

/** Fully populated byline author fixture. */
const AUTHOR: BylineAuthor = {
  key: 'smith',
  name: 'Alice Smith',
  superscript: '1',
  corresponding: true,
  equal: false,
  deceased: false,
  orcid: '0000-0002-1825-0097',
  email: 'alice@example.edu',
  roles: ['conceptualization'],
  affiliations: [{ id: 'ui', number: 1, name: 'University of Indonesia' }],
  group: false,
  members: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AuthorSheet', () => {
  it('shows the author name as the title and the author details in the body', () => {
    render(<AuthorSheet author={AUTHOR} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Alice Smith' })).toBeTruthy();
    expect(screen.getByTestId('author-details')).toBeTruthy();
    expect(screen.getByTestId('author-details-email').textContent).toBe('alice@example.edu');
  });

  it('renders an Edit action that calls onEdit', () => {
    const onEdit = vi.fn();
    render(<AuthorSheet author={AUTHOR} onClose={vi.fn()} onEdit={onEdit} />);
    const action = screen.getByTestId('bottom-sheet-action');
    expect(action.textContent).toBe('Edit');
    fireEvent.click(action);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders no footer action when onEdit is missing', () => {
    render(<AuthorSheet author={AUTHOR} onClose={vi.fn()} />);
    expect(screen.queryByTestId('bottom-sheet-action')).toBeNull();
  });
});
