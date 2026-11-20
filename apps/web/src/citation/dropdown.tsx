import type { CitationState, CitationAction } from "./types";
import { DoiInput } from "./doi-input";
import { ComparisonView, extractCitekey } from "./comparison";
import { resolveDoi, normalizeDoi } from "./doi-resolver";
import { buildSuggestions } from "./suggestions";
import type { Suggestion } from "./suggestions";
import { CitekeyItem } from "./citekey-item";
import { CrossrefItem } from "./crossref-item";

export {
  CitekeyItem,
  formatAuthor,
  formatEntryType,
} from "./citekey-item";
export type { CitekeyItemProps } from "./citekey-item";

interface CitationDropdownProps {
  /** Current citation state. */
  state: CitationState;
  /** Dispatch function for state updates. */
  dispatch: (action: CitationAction) => void;
  /** Callback when a suggestion is selected. */
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
      onAction={async (action, comparison) => {
        await onDoiResolved?.(comparison.editedBibtex);
        dispatch({ type: "CLOSE_CITATION" });
      }}
    />
  );
}

function renderDoiInput(
  state: CitationState,
  dispatch: (action: CitationAction) => void,
  onDoiResolved?: (bibtex: string) => void
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
          const citekey = extractCitekey(bibtex);
          const existing = citekey
            ? state.items.find((item) => item.citeKey === citekey)
            : undefined;

          if (existing) {
            // Duplicate: show comparison view with real current entry
            dispatch({
              type: "SET_COMPARISON",
              comparison: {
                current: existing,
                incoming: existing,
                editedBibtex: bibtex,
                originalCitekey: existing.citeKey,
              },
            });
          } else {
            // New DOI: save directly and close
            await onDoiResolved?.(bibtex);
            dispatch({ type: "CLOSE_CITATION" });
          }
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

function renderSuggestion(
  suggestion: Suggestion,
  index: number,
  activeIndex: number,
  onSelect: (key: string) => void,
) {
  return suggestion.kind === "crossref" ? (
    <CrossrefItem
      key={suggestion.key}
      label={suggestion.label}
      isActive={index === activeIndex}
      onSelect={onSelect}
    />
  ) : (
    <CitekeyItem
      key={suggestion.key}
      item={suggestion.reference}
      isActive={index === activeIndex}
      onSelect={onSelect}
    />
  );
}

interface SuggestionListProps {
  state: CitationState;
  onSelect: (key: string) => void;
  onAddCitation: () => void;
}

interface SuggestionGroupsProps {
  crossrefs: Suggestion[];
  citations: Suggestion[];
  activeIndex: number;
  emptyMessage: string;
  onSelect: (key: string) => void;
}

interface SuggestionGroupProps {
  heading: string;
  suggestions: Suggestion[];
  offset: number;
  activeIndex: number;
  onSelect: (key: string) => void;
}

function SuggestionGroup({
  heading,
  suggestions,
  offset,
  activeIndex,
  onSelect,
}: SuggestionGroupProps) {
  return (
    <div className="menu-group">
      <div className="citation-group-heading">{heading}</div>
      <ul>
        {suggestions.map((suggestion, index) =>
          renderSuggestion(suggestion, offset + index, activeIndex, onSelect),
        )}
      </ul>
    </div>
  );
}

function SuggestionGroups({
  crossrefs,
  citations,
  activeIndex,
  emptyMessage,
  onSelect,
}: SuggestionGroupsProps) {
  if (crossrefs.length === 0 && citations.length === 0) {
    return (
      <div className="menu-group">
        <ul>
          <li className="citation-empty">{emptyMessage}</li>
        </ul>
      </div>
    );
  }

  return (
    <>
      {crossrefs.length > 0 && (
        <SuggestionGroup
          heading="Cross-references"
          suggestions={crossrefs}
          offset={0}
          activeIndex={activeIndex}
          onSelect={onSelect}
        />
      )}
      {citations.length > 0 && (
        <SuggestionGroup
          heading="Citations"
          suggestions={citations}
          offset={crossrefs.length}
          activeIndex={activeIndex}
          onSelect={onSelect}
        />
      )}
    </>
  );
}

function getEmptyMessage(state: CitationState): string {
  const loadError = state.loadError ?? null;
  if (loadError) {
    return `references.bib could not be parsed (line ${loadError.line})`;
  }
  return state.items.length > 0
    ? "No matching citations"
    : "No references yet. Add one by DOI or create references.bib.";
}

function SuggestionList({ state, onSelect, onAddCitation }: SuggestionListProps) {
  const suggestions = buildSuggestions(
    state.items,
    state.crossrefs ?? [],
    state.query,
    state.trigger,
  );
  const crossrefs = suggestions.filter((s) => s.kind === "crossref");
  const citations = suggestions.filter((s) => s.kind === "citation");

  return (
    <div className="menu-groups">
      <SuggestionGroups
        crossrefs={crossrefs}
        citations={citations}
        activeIndex={state.activeIndex}
        emptyMessage={getEmptyMessage(state)}
        onSelect={onSelect}
      />
      <div className="menu-group">
        <ul>
          <li
            className="citation-add-btn"
            onPointerDown={(e) => e.preventDefault()}
            onPointerUp={onAddCitation}
          >
            + Add Citation (DOI)
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Citation dropdown component.
 *
 * Renders the cross-reference and citation suggestion groups, the DOI input,
 * the comparison view, or an error display based on the current state.
 *
 * Uses the same CSS classes as the slash menu for consistent styling.
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
      className="milkdown-slash-menu citation-dropdown"
      data-show="true"
      onPointerDown={(e) => e.preventDefault()}
    >
      {state.comparison ? (
        renderComparisonView(state, dispatch, onDoiResolved)
      ) : state.doiMode ? (
        renderDoiInput(state, dispatch, onDoiResolved)
      ) : (
        <SuggestionList
          state={state}
          onSelect={(key) => onSelectCitekey?.(key)}
          onAddCitation={() => dispatch({ type: "ENTER_DOI_MODE" })}
        />
      )}
    </div>
  );
}
