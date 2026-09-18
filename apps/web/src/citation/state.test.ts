import { describe, it, expect } from 'vitest';
import { citationReducer, createInitialState } from './state';
import type { CitationState } from './types';
import type { Reference } from '@opendraft/references';

const mockReference: Reference = {
  citeKey: 'doe2024',
  entryType: 'article',
  fields: {
    title: 'Example Article',
    author: 'Doe, Jane',
    year: '2024',
  },
};

describe('citationReducer - open', () => {
  it('opens dropdown with trigger', () => {
    const state = createInitialState();
    const result = citationReducer(state, {
      type: 'OPEN_CITATION',
      trigger: { from: 5, bracketed: false },
    });
    expect(result.open).toBe(true);
    expect(result.trigger).toEqual({ from: 5, bracketed: false });
    expect(result.query).toBe('');
    expect(result.activeIndex).toBe(0);
    expect(result.doiMode).toBe(false);
  });

  it('resets state on fresh open (closed -> open)', () => {
    const state: CitationState = {
      ...createInitialState(), open: false,
      query: 'old', activeIndex: 5, doiMode: true, doiInput: 'old doi',
    };
    const result = citationReducer(state, {
      type: 'OPEN_CITATION', trigger: { from: 0, bracketed: true },
    });
    expect(result.query).toBe('');
    expect(result.activeIndex).toBe(0);
    expect(result.doiMode).toBe(false);
    expect(result.doiInput).toBe('');
    expect(result.trigger?.bracketed).toBe(true);
  });

  it('preserves activeIndex on re-dispatch while already open', () => {
    const state: CitationState = {
      ...createInitialState(), open: true,
      trigger: { from: 0, bracketed: false }, activeIndex: 3,
    };
    const result = citationReducer(state, {
      type: 'OPEN_CITATION', trigger: { from: 0, bracketed: false },
    });
    expect(result.open).toBe(true);
    expect(result.activeIndex).toBe(3);
  });

  it('resets activeIndex on fresh open after close', () => {
    const state: CitationState = { ...createInitialState(), open: false, activeIndex: 3 };
    const result = citationReducer(state, {
      type: 'OPEN_CITATION', trigger: { from: 0, bracketed: false },
    });
    expect(result.activeIndex).toBe(0);
  });
});

describe('citationReducer - close', () => {
  it('closes dropdown and resets transient state', () => {
    const state: CitationState = {
      ...createInitialState(),
      open: true,
      query: 'test',
      doiMode: true,
      comparison: {
        current: mockReference,
        incoming: mockReference,
        editedBibtex: 'test',
        originalCitekey: 'doe2024',
      },
    };
    const result = citationReducer(state, { type: 'CLOSE_CITATION' });

    expect(result.open).toBe(false);
    expect(result.query).toBe('');
    expect(result.doiMode).toBe(false);
    expect(result.comparison).toBeNull();
    expect(result.error).toBeNull();
  });

  it('preserves items on close', () => {
    const state: CitationState = {
      ...createInitialState(),
      open: true,
      items: [mockReference],
    };
    const result = citationReducer(state, { type: 'CLOSE_CITATION' });

    expect(result.items).toEqual([mockReference]);
  });
});

describe('citationReducer - query/items', () => {
  it('SET_QUERY updates query and resets active index', () => {
    const state: CitationState = {
      ...createInitialState(),
      query: 'old',
      activeIndex: 3,
    };
    const result = citationReducer(state, { type: 'SET_QUERY', query: 'new' });

    expect(result.query).toBe('new');
    expect(result.activeIndex).toBe(0);
  });

  it('SET_ITEMS updates items list', () => {
    const state = createInitialState();
    const result = citationReducer(state, {
      type: 'SET_ITEMS',
      items: [mockReference],
    });

    expect(result.items).toEqual([mockReference]);
  });
});

describe('citationReducer - active index', () => {
  it('SET_ACTIVE_INDEX sets exact index', () => {
    const state = createInitialState();
    const result = citationReducer(state, { type: 'SET_ACTIVE_INDEX', index: 5 });

    expect(result.activeIndex).toBe(5);
  });

  it('INCREMENT_ACTIVE_INDEX increments by 1', () => {
    const state: CitationState = { ...createInitialState(), activeIndex: 2 };
    const result = citationReducer(state, { type: 'INCREMENT_ACTIVE_INDEX' });

    expect(result.activeIndex).toBe(3);
  });

  it('DECREMENT_ACTIVE_INDEX decrements by 1', () => {
    const state: CitationState = { ...createInitialState(), activeIndex: 2 };
    const result = citationReducer(state, { type: 'DECREMENT_ACTIVE_INDEX' });

    expect(result.activeIndex).toBe(1);
  });

  it('DECREMENT_ACTIVE_INDEX does not go below 0', () => {
    const state: CitationState = { ...createInitialState(), activeIndex: 0 };
    const result = citationReducer(state, { type: 'DECREMENT_ACTIVE_INDEX' });

    expect(result.activeIndex).toBe(0);
  });
});

describe('citationReducer - DOI mode', () => {
  it('ENTER_DOI_MODE switches to DOI mode', () => {
    const state = createInitialState();
    const result = citationReducer(state, { type: 'ENTER_DOI_MODE' });

    expect(result.doiMode).toBe(true);
  });

  it('EXIT_DOI_MODE switches back to citekey list', () => {
    const state: CitationState = { ...createInitialState(), doiMode: true };
    const result = citationReducer(state, { type: 'EXIT_DOI_MODE' });

    expect(result.doiMode).toBe(false);
    expect(result.doiInput).toBe('');
  });

  it('SET_DOI_INPUT updates DOI input value', () => {
    const state = createInitialState();
    const result = citationReducer(state, {
      type: 'SET_DOI_INPUT',
      doi: '10.1234/test',
    });

    expect(result.doiInput).toBe('10.1234/test');
  });

  it('SET_DOI_LOADING updates loading state', () => {
    const state = createInitialState();
    const result = citationReducer(state, {
      type: 'SET_DOI_LOADING',
      loading: true,
    });

    expect(result.doiLoading).toBe(true);
  });
});

describe('citationReducer - comparison', () => {
  it('SET_COMPARISON sets comparison state', () => {
    const state = createInitialState();
    const comparison = {
      current: mockReference,
      incoming: mockReference,
      editedBibtex: '@article{doe2024, title={Test}}',
      originalCitekey: 'doe2024',
    };
    const result = citationReducer(state, {
      type: 'SET_COMPARISON',
      comparison,
    });

    expect(result.comparison).toEqual(comparison);
  });

  it('DISCARD_DOI clears comparison and DOI mode', () => {
    const state: CitationState = {
      ...createInitialState(),
      doiMode: true,
      comparison: {
        current: mockReference,
        incoming: mockReference,
        editedBibtex: 'test',
        originalCitekey: 'doe2024',
      },
    };
    const result = citationReducer(state, { type: 'DISCARD_DOI' });

    expect(result.comparison).toBeNull();
    expect(result.doiMode).toBe(false);
  });
});

describe('citationReducer - error', () => {
  it('SET_ERROR sets error state', () => {
    const state = createInitialState();
    const result = citationReducer(state, {
      type: 'SET_ERROR',
      error: { message: 'Failed to fetch' },
    });

    expect(result.error).toEqual({ message: 'Failed to fetch' });
  });

  it('CLEAR_ERROR clears error state', () => {
    const state: CitationState = {
      ...createInitialState(),
      error: { message: 'Failed to fetch' },
    };
    const result = citationReducer(state, { type: 'CLEAR_ERROR' });

    expect(result.error).toBeNull();
  });
});
