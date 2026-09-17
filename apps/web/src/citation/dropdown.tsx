import type { CitationState, CitationAction } from "./types";
import { filterCitekeys } from "./citekey-list";
import { DoiInput } from "./doi-input";
import { ComparisonView } from "./comparison";
import { resolveDoi, normalizeDoi } from "./doi-resolver";

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

function renderComparisonView(
  state: CitationState,
  dispatch: (action: CitationAction) => void,
  onDoiResolved?: (bibtex: string) => void
) {
  return (
    <ComparisonView
      comparison={state.comparison!}
      onBibtexChange={(bibtex) =>
        dispatch({ type: "SET_COMPARISON", comparison: { ...state.comparison!, editedBibtex: bibtex } })
      }
      onDiscard={() => dispatch({ type: "DISCARD_DOI" })}
      onAction={(action, comparison) => {
        if (action === "replace") {
          onDoiResolved?.(comparison.editedBibtex);
        } else {
          onDoiResolved?.(comparison.editedBibtex);
        }
        dispatch({ type: "CLOSE_CITATION" });
      }}
    />
  );
}

function renderDoiInput(
  state: CitationState,
  dispatch: (action: CitationAction) => void
) {
  return (
    <DoiInput
      doi={state.doiInput}
      onDoiChange={(doi) => dispatch({ type: "SET_DOI_INPUT", doi })}
      onResolve={async (doi) => {
        const normalized = normalizeDoi(doi);
        if (!normalized) {
          dispatch({ type: "SET_ERROR", error: { message: "Invalid DOI format" } });
          return;
        }
        dispatch({ type: "SET_DOI_LOADING", loading: true });
        try {
          const bibtex = await resolveDoi(normalized);
          const emptyRef = { citeKey: "", entryType: "", fields: {} as Record<string, string> };
          dispatch({ type: "SET_COMPARISON", comparison: { current: emptyRef, incoming: emptyRef, editedBibtex: bibtex, originalCitekey: "" } });
        } catch (err) {
          const message = err instanceof Error ? err.message : "DOI resolution failed";
          dispatch({ type: "SET_ERROR", error: { message } });
          dispatch({ type: "SET_DOI_LOADING", loading: false });
        }
      }}
      onEscape={() => dispatch({ type: "EXIT_DOI_MODE" })}
    />
  );
}

function renderCitekeyList(
  state: CitationState,
  dispatch: (action: CitationAction) => void,
  onSelectCitekey?: (citekey: string) => void
) {
  return (
    <CitekeyList
      items={state.items}
      query={state.query}
      activeIndex={state.activeIndex}
      onQueryChange={(query) => dispatch({ type: "SET_QUERY", query })}
      onSelect={(citekey) => onSelectCitekey?.(citekey)}
      onAddCitation={() => dispatch({ type: "ENTER_DOI_MODE" })}
    />
  );
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
    <div
      data-testid="citation-dropdown"
      className="citation-dropdown"
    >
      {state.comparison ? (
        renderComparisonView(state, dispatch, onDoiResolved)
      ) : state.doiMode ? (
        renderDoiInput(state, dispatch)
      ) : (
        renderCitekeyList(state, dispatch, onSelectCitekey)
      )}
    </div>
  );
}

interface CitekeyListProps {
  items: CitationState["items"];
  query: string;
  activeIndex: number;
  onQueryChange: (query: string) => void;
  onSelect: (citekey: string) => void;
  onAddCitation: () => void;
}

function EmptyState({ hasItems, hasQuery }: { hasItems: boolean; hasQuery: boolean }) {
  const message = hasItems || hasQuery
    ? "No matching citations"
    : "No references yet. Add one by DOI or create references.bib.";
  return <div className="citation-empty">{message}</div>;
}

interface CitekeyItemProps {
  item: CitationState["items"][number];
  isActive: boolean;
  onSelect: (citekey: string) => void;
}

function CitekeyItem({ item, isActive, onSelect }: CitekeyItemProps) {
  return (
    <button
      type="button"
      className={"citation-item " + (isActive ? "active" : "")}
      onClick={() => onSelect(item.citeKey)}
    >
      <span className="citation-key">{item.citeKey}</span>
      <span className="citation-meta">
        {item.fields.author?.split(",")[0]} {item.fields.year}
      </span>
    </button>
  );
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
          <EmptyState hasItems={items.length > 0} hasQuery={!!query} />
        ) : (
          filtered.map((item, index) => (
            <CitekeyItem
              key={item.citeKey}
              item={item}
              isActive={index === activeIndex}
              onSelect={onSelect}
            />
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