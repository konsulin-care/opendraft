import type { CitationState, CitationAction } from './types';
import { filterCitekeys } from './citekey-list';
import { DoiInput } from './doi-input';
import { ComparisonView } from './comparison';

interface CitationDropdownProps {
  /** Current citation state. */
  state: CitationState;
  /** Dispatch function for state updates. */
  dispatch: (action: CitationAction) => void;
  /** Callback when a citekey is selected. */
  onSelectCitekey?: (citekey: string) => void;
  /** Callback when DOI is resolved. */
  onDoiResolved?: (bibtex: string) => void;
}

/**
 * Citation dropdown component.
 *
 * Renders citekey list, DOI input, comparison view,
 * or error display based on current state.
 */
export function CitationDropdown({
  state,
  dispatch,
  onSelectCitekey,
  onDoiResolved,
}: CitationDropdownProps) {
  if (!state.open) return null;

  return (
    <div className="citation-dropdown">
      {state.comparison ? (
        <ComparisonView
          comparison={state.comparison}
          onBibtexChange={(bibtex) =>
            dispatch({ type: 'SET_COMPARISON', comparison: { ...state.comparison!, editedBibtex: bibtex } })
          }
          onDiscard={() => dispatch({ type: 'DISCARD_DOI' })}
          onAction={(action, comparison) => {
            if (action === 'replace') {
              onDoiResolved?.(comparison.editedBibtex);
            } else {
              onDoiResolved?.(comparison.editedBibtex);
            }
            dispatch({ type: 'CLOSE_CITATION' });
          }}
        />
      ) : state.doiMode ? (
        <DoiInput
          doi={state.doiInput}
          onDoiChange={(doi) => dispatch({ type: 'SET_DOI_INPUT', doi })}
          onResolve={(_doi) => {
            dispatch({ type: 'SET_DOI_LOADING', loading: true });
            // TODO: Call DOI resolver and handle response
          }}
          onEscape={() => dispatch({ type: 'EXIT_DOI_MODE' })}
        />
      ) : (
        <CitekeyList
          items={state.items}
          query={state.query}
          activeIndex={state.activeIndex}
          onQueryChange={(query) => dispatch({ type: 'SET_QUERY', query })}
          onSelect={(citekey) => onSelectCitekey?.(citekey)}
          onAddCitation={() => dispatch({ type: 'ENTER_DOI_MODE' })}
        />
      )}
    </div>
  );
}

interface CitekeyListProps {
  items: CitationState['items'];
  query: string;
  activeIndex: number;
  onQueryChange: (query: string) => void;
  onSelect: (citekey: string) => void;
  onAddCitation: () => void;
}

function CitekeyList({
  items,
  query,
  activeIndex,
  onQueryChange,
  onSelect,
  onAddCitation,
}: CitekeyListProps) {
  const filtered = filterCitekeys(items, query);

  return (
    <div className="citation-list">
      <input
        type="text"
        className="citation-search"
        placeholder="Search citations..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <div className="citation-items">
        {filtered.length === 0 ? (
          <div className="citation-empty">No matching citations</div>
        ) : (
          filtered.map((item, index) => (
            <button
              key={item.citeKey}
              type="button"
              className={`citation-item ${index === activeIndex ? 'active' : ''}`}
              onClick={() => onSelect(item.citeKey)}
            >
              <span className="citation-key">{item.citeKey}</span>
              <span className="citation-meta">
                {item.fields.author?.split(',')[0]} {item.fields.year}
              </span>
            </button>
          ))
        )}
      </div>
      <button
        type="button"
        className="citation-add-btn"
        onClick={onAddCitation}
      >
        + Add Citation (DOI)
      </button>
    </div>
  );
}
