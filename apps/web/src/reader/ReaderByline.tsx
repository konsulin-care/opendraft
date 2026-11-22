/**
 * Read-only byline of the reader.
 *
 * Renders the author names with their affiliation superscript numbers and
 * symbol flags, the numbered affiliation list and the symbol-only footnotes
 * from a derived byline model. Span and div elements only: the block has no
 * interactive controls.
 */
import type { ReactNode } from 'react';
import type { BylineAuthor, BylineModel } from '../components/metadata-panel/byline-model';

/** Props for {@link ReaderByline}. */
export interface ReaderBylineProps {
  /** Byline model derived from the manuscript author and affiliation metadata. */
  model: BylineModel;
}

/**
 * Render the symbol suffix of one author (`*`, `†`, `‡`).
 *
 * @param author - One author of the byline model.
 * @returns The symbol characters in canonical order.
 */
function authorSymbols(author: BylineAuthor): string {
  return (author.corresponding ? '*' : '')
    + (author.equal ? '†' : '')
    + (author.deceased ? '‡' : '');
}

/**
 * Render the byline of a reader manuscript.
 *
 * @param props - See {@link ReaderBylineProps}.
 * @returns The author line, numbered affiliations and footnotes.
 */
export function ReaderByline({ model }: ReaderBylineProps): ReactNode {
  return (
    <div className="mt-3 text-base text-muted" data-testid="reader-byline">
      <div data-testid="reader-byline-authors">
        {model.authors.map((author, index) => {
          const symbols = authorSymbols(author);
          return (
            <span key={author.key}>
              {index > 0 ? ', ' : null}
              <span>{author.name}</span>
              {author.onBehalfOf ? <span> {author.onBehalfOf}</span> : null}
              {author.superscript || symbols ? (
                <span
                  data-testid={`reader-byline-superscript-${index}`}
                  className="align-super text-xs"
                >
                  {author.superscript}
                  {symbols}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      {model.affiliations.length > 0 ? (
        <div className="mt-1" data-testid="reader-affiliation-list">
          {model.affiliations.map((entry) => (
            <div key={entry.id}>{entry.number}. {entry.name}</div>
          ))}
        </div>
      ) : null}
      {model.footnotes.length > 0 ? (
        <div className="mt-1" data-testid="reader-byline-footnotes">
          {model.footnotes.map((line) => <div key={line}>{line}</div>)}
        </div>
      ) : null}
    </div>
  );
}

export default ReaderByline;
