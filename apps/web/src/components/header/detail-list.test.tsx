// @vitest-environment jsdom
/**
 * Shared detail-list primitives used by the editor and reader details panels:
 * a definition list, a row with an optional muted term, and the shared class
 * constants both panels consume.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DETAIL_TERM, DETAIL_VALUE, DetailList, DetailRow } from './detail-list';

describe('DetailRow', () => {
  it('renders its term in the muted term cell and its value in the value cell', () => {
    render(
      <DetailList>
        <DetailRow term="Repository">owner/repo</DetailRow>
      </DetailList>,
    );

    const term = screen.getByText('Repository');
    const value = screen.getByText('owner/repo');
    expect(term.tagName).toBe('DT');
    expect(term).toHaveClass(...DETAIL_TERM.split(' '));
    expect(value.tagName).toBe('DD');
    expect(value).toHaveClass(...DETAIL_VALUE.split(' '));
  });

  it('renders only the value when no term is supplied', () => {
    render(
      <DetailList>
        <DetailRow>Changes are saved in this browser</DetailRow>
      </DetailList>,
    );

    const list = screen.getByRole('definition');
    expect(list.tagName).toBe('DD');
    expect(list.closest('dl')?.querySelector('dt')).toBeNull();
  });

  it('renders rows in the order they are supplied', () => {
    render(
      <DetailList>
        <DetailRow term="First">one</DetailRow>
        <DetailRow term="Second">two</DetailRow>
      </DetailList>,
    );

    const terms = screen.getAllByRole('term').map((node) => node.textContent);
    expect(terms).toEqual(['First', 'Second']);
  });
});
