/**
 * Read-only byline of the reader.
 *
 * Renders each author name as a text-styled button keeping the affiliation
 * superscript numbers and symbol flags, shows the shared author tooltip on
 * mouse hover/focus and opens the author sheet on a touch tap. The symbol
 * footnotes stay; the numbered affiliation list has been removed because the
 * affiliations are shown inside the author details.
 */
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthorSheet } from '../components/metadata-panel/AuthorSheet';
import { AuthorTooltip } from '../components/metadata-panel/AuthorDetails';
import type { BylineAuthor, BylineModel } from '../components/metadata-panel/byline-model';
import { createPointerKindTracker } from '../hooks/pointer-kind';
import type { PointerKindEvent } from '../hooks/pointer-kind';

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

/** Props for {@link ReaderBylineAuthor}. */
interface ReaderBylineAuthorProps {
  /** Author rendered by this segment. */
  author: BylineAuthor;
  /** Index of the author in the byline model. */
  index: number;
}

/**
 * One reader author name button with its superscript, tooltip and sheet.
 *
 * @param props - See {@link ReaderBylineAuthorProps}.
 * @returns The author segment.
 */
function ReaderBylineAuthor({ author, index }: ReaderBylineAuthorProps): ReactNode {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pointerKind = useRef(createPointerKindTracker()).current;
  const symbols = authorSymbols(author);
  const showTooltip = (): void => { if (!pointerKind.isTouch()) setTooltipOpen(true); };
  const handlePointerDown = (event: PointerKindEvent): void => { pointerKind.record(event); };
  const handleClick = (): void => { if (pointerKind.isTouch()) setSheetOpen(true); };
  return (
    <span className="relative inline-block">
      <button
        type="button"
        data-testid={`reader-byline-author-${index}`}
        aria-describedby={tooltipOpen ? `reader-byline-tooltip-${index}` : undefined}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onFocus={showTooltip}
        onBlur={() => setTooltipOpen(false)}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setTooltipOpen(false)}
        className="min-h-11 rounded px-0.5 text-muted hover:bg-hover"
      >
        {author.name}
        {author.onBehalfOf ? <span> {author.onBehalfOf}</span> : null}
        {author.superscript || symbols ? (
          <span data-testid={`reader-byline-superscript-${index}`} className="align-super text-xs">
            {author.superscript}
            {symbols}
          </span>
        ) : null}
      </button>
      {tooltipOpen ? (
        <AuthorTooltip author={author} id={`reader-byline-tooltip-${index}`} />
      ) : null}
      {sheetOpen ? (
        <AuthorSheet author={author} onClose={() => setSheetOpen(false)} />
      ) : null}
    </span>
  );
}

/**
 * Render the byline of a reader manuscript.
 *
 * @param props - See {@link ReaderBylineProps}.
 * @returns The author line and symbol footnotes.
 */
export function ReaderByline({ model }: ReaderBylineProps): ReactNode {
  return (
    <div className="mt-3 text-base text-muted" data-testid="reader-byline">
      <div data-testid="reader-byline-authors">
        {model.authors.map((author, index) => (
          <span key={author.key}>
            {index > 0 ? ', ' : null}
            <ReaderBylineAuthor author={author} index={index} />
          </span>
        ))}
      </div>
      {model.footnotes.length > 0 ? (
        <div className="mt-1" data-testid="reader-byline-footnotes">
          {model.footnotes.map((line) => <div key={line}>{line}</div>)}
        </div>
      ) : null}
    </div>
  );
}

export default ReaderByline;
