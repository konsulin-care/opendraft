/** Props for {@link ManuscriptCard}. */
export interface ManuscriptCardProps {
  /** Folder id of the manuscript, e.g. `alpha`. */
  id: string;
  /** Title from `_frontmatter.yml`; '' when missing or empty. */
  title: string;
  /** Author byline, '' when the manuscript has no named authors. */
  byline: string;
  /** Keyword pills in file order; empty when there are none. */
  keywords: string[];
  /** Open the manuscript directory `manuscripts/<id>`. */
  onOpen: () => void;
}

/**
 * One manuscript entry of the manuscripts overview: the title, or the
 * folder id in muted text when the title is empty, followed by the
 * author byline and the keyword pills pinned to the bottom of the card.
 * Empty byline and keyword rows are omitted entirely; clicking the card
 * opens the manuscript directory.
 *
 * @param props - See {@link ManuscriptCardProps}.
 * @returns The clickable overview card.
 */
export function ManuscriptCard({ id, title, byline, keywords, onOpen }: ManuscriptCardProps) {
  return (
    <button
      type="button"
      data-testid="manuscript-card"
      data-id={id}
      onClick={onOpen}
      className="flex h-full flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-blue-600-18 hover:shadow"
    >
      {title ? (
        <span data-testid="manuscript-card-title" className="text-base font-semibold text-gray-900">
          {title}
        </span>
      ) : (
        <span data-testid="manuscript-card-id" className="text-base text-gray-500">
          {id}
        </span>
      )}
      {byline && (
        <span data-testid="manuscript-card-byline" className="text-sm text-gray-600">
          {byline}
        </span>
      )}
      {keywords.length > 0 && (
        <span
          data-testid="manuscript-card-keywords"
          className="mt-auto flex flex-wrap gap-1 pt-1"
        >
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {keyword}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
