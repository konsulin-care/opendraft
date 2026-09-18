import type { CitationState, CitationAction } from "./types";
import { filterCitekeys } from "./citekey-list";
import { DoiInput } from "./doi-input";
import { ComparisonView, extractCitekey } from "./comparison";
import { resolveDoi, normalizeDoi } from "./doi-resolver";

/**
 * Extract first author from BibTeX `author` field.
 *
 * BibTeX stores authors as `"Last, First"` or `"Last, First and Last, First"`.
 * Returns `"First Last"` for the first author, or `null` if unavailable.
 *
 * @param author - Raw BibTeX author string.
 * @returns Formatted first author name, or null.
 */
export function formatAuthor(author: string | undefined): string | null {
  if (!author || !author.trim()) return null;

  const firstAuthor = author.split(' and ')[0].trim();
  const parts = firstAuthor.split(',').map((p) => p.trim());

  if (parts.length >= 2) {
    // "Last, First" -> "First Last"
    return `${parts[1]} ${parts[0]}`;
  }

  // Already in "First Last" or single-name format
  return firstAuthor;
}

/**
 * Capitalize first letter of entry type.
 *
 * @param entryType - BibTeX entry type (e.g. "article").
 * @returns Capitalized entry type (e.g. "Article").
 */
export function formatEntryType(entryType: string): string {
  if (!entryType) return '';
  return entryType.charAt(0).toUpperCase() + entryType.slice(1);
}

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
      onPointerDown={(e) => e.preventDefault()}
    >
      {state.comparison ? (
        renderComparisonView(state, dispatch, onDoiResolved)
      ) : state.doiMode ? (
        renderDoiInput(state, dispatch, onDoiResolved)
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
  onSelect: (citekey: string) => void;
  onAddCitation: () => void;
}

export interface CitekeyItemProps {
  item: CitationState["items"][number];
  isActive: boolean;
  onSelect: (citekey: string) => void;
}

export function CitekeyItem({ item, isActive, onSelect }: CitekeyItemProps) {
  const author = formatAuthor(item.fields.author);
  const displayName = author ?? item.citeKey;
  const year = item.fields.year;
  const entryType = item.entryType;
  const title = item.fields.title;

  return (
    <button
      type="button"
      className={"citation-item " + (isActive ? "active" : "")}
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => onSelect(item.citeKey)}
    >
      <div className="citation-line-1">
        <span className="citation-author">{displayName}</span>
        {year && <span className="citation-year"> ({year})</span>}
        {entryType && <span className="citation-type"> · {formatEntryType(entryType)}</span>}
      </div>
      {title && <div className="citation-title">{title}</div>}
    </button>
  );
}

function CitekeyList({
  items,
  query,
  activeIndex,
  onSelect,
  onAddCitation,
}: CitekeyListProps) {
  const filtered = filterCitekeys(items, query);

  return (
    <div className="citation-list">
      <div className="citation-items">
        {filtered.length === 0 ? (
          <div className="citation-empty">
            {items.length > 0
              ? "No matching citations"
              : "No references yet. Add one by DOI or create references.bib."}
          </div>
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
        onPointerDown={(e) => e.preventDefault()}
        onClick={onAddCitation}
      >
        + Add Citation (DOI)
      </button>
    </div>
  );
}