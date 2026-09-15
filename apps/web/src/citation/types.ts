import type { Reference } from '@opendraft/references';

/** Trigger context for citation dropdown. */
export interface CitationTrigger {
  /** Position of @ in the document. */
  from: number;
  /** Whether this is bracketed mode [@...]. */
  bracketed: boolean;
  /** Screen Y coordinate relative to scroll container. */
  top: number;
  /** Screen X coordinate relative to scroll container. */
  left: number;
}

/** Comparison state for duplicate DOI detection. */
export interface ComparisonState {
  /** Current entry in reference.bib (read-only). */
  current: Reference;
  /** New entry from DOI fetch (editable). */
  incoming: Reference;
  /** User-edited BibTeX string. */
  editedBibtex: string;
  /** Original citekey from DOI response. */
  originalCitekey: string;
}

/** Error state for DOI resolution. */
export interface CitationError {
  /** Error message to display. */
  message: string;
}

/** Citation plugin state. */
export interface CitationState {
  /** Whether the dropdown is open. */
  open: boolean;
  /** Current search query (text after @). */
  query: string;
  /** All citekeys loaded from reference.bib. */
  items: Reference[];
  /** Currently highlighted item index. */
  activeIndex: number;
  /** Trigger context: where @ was typed. */
  trigger: CitationTrigger | null;
  /** DOI input mode. */
  doiMode: boolean;
  /** Current DOI input value. */
  doiInput: string;
  /** Loading state for DOI fetch. */
  doiLoading: boolean;
  /** Comparison view for duplicate detection. */
  comparison: ComparisonState | null;
  /** Error state. */
  error: CitationError | null;
}

/** Actions for citation state reducer. */
export type CitationAction =
  | { type: 'OPEN_CITATION'; trigger: CitationTrigger }
  | { type: 'CLOSE_CITATION' }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_ITEMS'; items: Reference[] }
  | { type: 'SET_ACTIVE_INDEX'; index: number }
  | { type: 'INCREMENT_ACTIVE_INDEX' }
  | { type: 'DECREMENT_ACTIVE_INDEX' }
  | { type: 'ENTER_DOI_MODE' }
  | { type: 'EXIT_DOI_MODE' }
  | { type: 'SET_DOI_INPUT'; doi: string }
  | { type: 'SET_DOI_LOADING'; loading: boolean }
  | { type: 'SET_COMPARISON'; comparison: ComparisonState }
  | { type: 'DISCARD_DOI' }
  | { type: 'SET_ERROR'; error: CitationError }
  | { type: 'CLEAR_ERROR' };
