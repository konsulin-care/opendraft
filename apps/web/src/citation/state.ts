import type { CitationState, CitationAction } from './types';

/** Create the initial citation state. */
export function createInitialState(): CitationState {
  return {
    open: false,
    query: '',
    items: [],
    activeIndex: 0,
    trigger: null,
    doiMode: false,
    doiInput: '',
    doiLoading: false,
    comparison: null,
    error: null,
  };
}

/** Handle open/close actions. */
function handleOpenClose(state: CitationState, action: CitationAction): CitationState | null {
  if (action.type === 'OPEN_CITATION') {
    // Preserve activeIndex when re-dispatched while already open (provider reposition).
    // Only reset on fresh open (closed -> open).
    const preserveIndex = state.open;
    return {
      ...state,
      open: true,
      trigger: action.trigger,
      query: preserveIndex ? state.query : '',
      activeIndex: preserveIndex ? state.activeIndex : 0,
      doiMode: false,
      doiInput: '',
      doiLoading: false,
      comparison: null,
      error: null,
    };
  }
  if (action.type === 'CLOSE_CITATION') {
    return {
      ...state,
      open: false,
      query: '',
      trigger: null,
      doiMode: false,
      doiInput: '',
      doiLoading: false,
      comparison: null,
      error: null,
    };
  }
  return null;
}

/** Handle query and items actions. */
function handleQueryItems(state: CitationState, action: CitationAction): CitationState | null {
  if (action.type === 'SET_QUERY') {
    return { ...state, query: action.query, activeIndex: 0 };
  }
  if (action.type === 'SET_ITEMS') {
    return { ...state, items: action.items };
  }
  return null;
}

/** Handle active index actions. */
function handleActiveIndex(state: CitationState, action: CitationAction): CitationState | null {
  if (action.type === 'SET_ACTIVE_INDEX') {
    return { ...state, activeIndex: action.index };
  }
  if (action.type === 'INCREMENT_ACTIVE_INDEX') {
    return { ...state, activeIndex: state.activeIndex + 1 };
  }
  if (action.type === 'DECREMENT_ACTIVE_INDEX') {
    return { ...state, activeIndex: Math.max(0, state.activeIndex - 1) };
  }
  return null;
}

/** Handle DOI mode actions. */
function handleDoiMode(state: CitationState, action: CitationAction): CitationState | null {
  if (action.type === 'ENTER_DOI_MODE') {
    return { ...state, doiMode: true, query: '', activeIndex: 0 };
  }
  if (action.type === 'EXIT_DOI_MODE') {
    return { ...state, doiMode: false, doiInput: '' };
  }
  if (action.type === 'SET_DOI_INPUT') {
    return { ...state, doiInput: action.doi };
  }
  if (action.type === 'SET_DOI_LOADING') {
    return { ...state, doiLoading: action.loading };
  }
  return null;
}

/** Handle comparison and error actions. */
function handleComparisonError(state: CitationState, action: CitationAction): CitationState | null {
  if (action.type === 'SET_COMPARISON') {
    return { ...state, comparison: action.comparison };
  }
  if (action.type === 'DISCARD_DOI') {
    return { ...state, doiMode: false, comparison: null };
  }
  if (action.type === 'SET_ERROR') {
    return { ...state, error: action.error };
  }
  if (action.type === 'CLEAR_ERROR') {
    return { ...state, error: null };
  }
  return null;
}

/** Citation state reducer. */
export function citationReducer(state: CitationState, action: CitationAction): CitationState {
  return (
    handleOpenClose(state, action) ??
    handleQueryItems(state, action) ??
    handleActiveIndex(state, action) ??
    handleDoiMode(state, action) ??
    handleComparisonError(state, action) ??
    state
  );
}
