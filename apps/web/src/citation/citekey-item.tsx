import type { CitationState } from "./types";

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

  const firstAuthor = author.split(" and ")[0].trim();
  const parts = firstAuthor.split(",").map((p) => p.trim());

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
  if (!entryType) return "";
  return entryType.charAt(0).toUpperCase() + entryType.slice(1);
}

/** Props for a single citation row in the `@` dropdown. */
export interface CitekeyItemProps {
  /** The reference this row renders. */
  item: CitationState["items"][number];
  /** Whether the row is currently highlighted. */
  isActive: boolean;
  /** Called with the citekey when the row is selected. */
  onSelect: (citekey: string) => void;
}

/**
 * Render one citation row: author, year and entry type on line 1, title on
 * line 2, with the citekey as the author fallback.
 *
 * @param props - The item, active flag and selection callback.
 * @returns The citation list item.
 */
export function CitekeyItem({ item, isActive, onSelect }: CitekeyItemProps) {
  const author = formatAuthor(item.fields.author);
  const displayName = author ?? item.citeKey;
  const year = item.fields.year;
  const entryType = item.entryType;
  const title = item.fields.title;

  return (
    <li
      className={isActive ? "hover" : ""}
      onPointerDown={(e) => e.preventDefault()}
      onPointerUp={() => onSelect(item.citeKey)}
    >
      <div className="citation-item-body">
        <div className="citation-line-1">
          <span className="citation-author">{displayName}</span>
          {year && <span className="citation-year"> ({year})</span>}
          {entryType && (
            <span className="citation-type">{formatEntryType(entryType)}</span>
          )}
        </div>
        <div className="citation-line-2">
          {title && (
            <span className="citation-title" title={title}>
              {title}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
