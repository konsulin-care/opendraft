// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CitationDropdown } from './dropdown';
import type { CitationState } from './types';
import type { Reference } from '@opendraft/references';

const mockReferences: Reference[] = [
  {
    citeKey: 'doe2024',
    entryType: 'article',
    fields: { title: 'Example Article', author: 'Doe, Jane', year: '2024' },
  },
];

function createOpenState(overrides?: Partial<CitationState>): CitationState {
  return {
    open: true,
    query: '',
    items: mockReferences,
    activeIndex: 0,
    trigger: { from: 5, bracketed: false },
    doiMode: false,
    doiInput: '',
    doiLoading: false,
    comparison: null,
    error: null,
    ...overrides,
  };
}

describe('CitationDropdown', () => {
  it('renders when open', () => {
    const dispatch = vi.fn();
    const state = createOpenState();

    render(
      <CitationDropdown state={state} dispatch={dispatch} />
    );

    expect(screen.getByText('doe2024')).toBeDefined();
  });

  it('does not render when closed', () => {
    const dispatch = vi.fn();
    const state: CitationState = {
      ...createOpenState(),
      open: false,
    };

    const { container } = render(
      <CitationDropdown state={state} dispatch={dispatch} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders Add Citation item', () => {
    const dispatch = vi.fn();
    const state = createOpenState();

    render(
      <CitationDropdown state={state} dispatch={dispatch} />
    );

    expect(screen.getByText(/Add Citation/)).toBeDefined();
  });
});
