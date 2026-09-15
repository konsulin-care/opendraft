import { useEffect, useRef } from "react";
import type { CitationState, CitationAction } from "./types";
import { filterCitekeys } from "./citekey-list";
import { DoiInput } from "./doi-input";
import { ComparisonView } from "./comparison";

interface CitationDropdownProps {
  /** Current citation state. */
  state: CitationState;
  /** Dispatch function for state updates. */
  dispatch: (action: CitationAction) => void;
  /** Callback when a citekey is selected. */
  onSelectCitekey?: (citekey: string) => void;
  /** Callback when DOI is resolved. */
  onDoiResolved?: (bibtex: string) => void;
  /** Reference to the scroll container for coordinate conversion. */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function useDropdownPosition(
  state: CitationState,
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  dropdownRef: React.RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    if (!state.trigger || !scrollContainerRef.current || !dropdownRef.current) return;

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Viewport coordinates from trigger
    const viewportTop = state.trigger.top;
    const viewportLeft = state.trigger.left;

    // Convert to container-relative coordinates
    const top = viewportTop - containerRect.top + container.scrollTop;
    const left = viewportLeft - containerRect.left + container.scrollLeft;

    // Position dropdown below the cursor (add line height ~1.5em)
    dropdownRef.current.style.top = top + 20 + "px";
    dropdownRef.current.style.left = left + "px";
  }, [state.trigger, scrollContainerRef]);
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
      onResolve={(_doi) => {
        dispatch({ type: "SET_DOI_LOADING", loading: true });
        // TODO: Call DOI resolver and handle response
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
  scrollContainerRef,
}: CitationDropdownProps) {
  if (!state.open) return null;

  const dropdownRef = useRef<HTMLDivElement>(null);
  useDropdownPosition(state, scrollContainerRef, dropdownRef);

  return (
    <div ref={dropdownRef} className="citation-dropdown" style={{ position: "absolute" }}>
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