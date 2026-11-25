/**
 * Byline row of the article view: author name buttons with affiliation
 * superscripts, symbol flags, ORCID markers and the shared hover/focus
 * author tooltip, symbol-only footnotes and the add-author button.
 *
 * The add-author button is a pulsing black CTA while the manuscript has
 * no authors and reverts to the muted default style once at least one
 * author exists. Name chips open the author form on mouse click and the
 * author sheet on touch tap; pressing and holding a chip for the hold
 * threshold then dropping on another chip reorders the authors — no drag
 * handle is rendered. Hover/focus tooltips are suppressed after a touch.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Info, Plus } from 'lucide-react';
import { createPointerKindTracker } from '../../hooks/pointer-kind';
import type { PointerKindEvent } from '../../hooks/pointer-kind';
import { AuthorSheet } from './AuthorSheet';
import { AuthorTooltip } from './AuthorDetails';
import type { BylineModel } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';
import { usePressDrag } from './use-press-drag';

/** Icon size used by the ORCID marker. */
const ICON = 'inline size-4 shrink-0';

/** Props for {@link Byline}. */
export interface BylineProps {
  /** Derived byline model of the manuscript. */
  model: BylineModel;
  /** Raw author entries in authorship order, used for press-drag reordering. */
  authors: MetadataAuthor[];
  /** Persist the reordered author array to _author.yml. */
  setAuthors: (authors: MetadataAuthor[]) => void;
  /** Open the author form; receives the author index, or -1 for a draft. */
  onOpenName: (index: number) => void;
}

/** Classes of the muted default add-author button. */
const ADD_MUTED = 'ml-2 min-h-11 rounded text-muted hover:bg-hover';

/** Classes of the pulsing black add-author CTA shown when there are no authors. */
const ADD_CTA = 'ml-2 min-h-11 rounded bg-black px-2 text-white animate-pulse hover:opacity-90';

/** State and handlers of one byline name button. */
interface BylineTap {
  /** Whether the hover/focus tooltip is visible. */
  tooltipOpen: boolean;
  /** Whether the touch author sheet is visible. */
  sheetOpen: boolean;
  /** Record the pointer type of the interaction. */
  onPointerDown: (event: PointerKindEvent) => void;
  /** Open the sheet on touch or the author form on mouse. */
  onClick: () => void;
  /** Show the tooltip for non-touch focus. */
  onFocus: () => void;
  /** Hide the tooltip on blur. */
  onBlur: () => void;
  /** Show the tooltip for non-touch hover. */
  onMouseEnter: () => void;
  /** Hide the tooltip on mouse leave. */
  onMouseLeave: () => void;
  /** Close the touch author sheet. */
  closeSheet: () => void;
}

/** Track pointer kind and sheet/tooltip visibility for one byline name. */
function useBylineTap(
  index: number,
  onOpen: (index: number) => void,
  filterClick: () => boolean,
): BylineTap {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pointerKind = useRef(createPointerKindTracker()).current;
  const showTooltip = (): void => { if (!pointerKind.isTouch()) setTooltipOpen(true); };
  return {
    tooltipOpen,
    sheetOpen,
    onPointerDown: (event) => pointerKind.record(event),
    onClick: () => {
      if (!filterClick()) return;
      if (pointerKind.isTouch()) setSheetOpen(true);
      else onOpen(index);
    },
    onFocus: showTooltip,
    onBlur: () => setTooltipOpen(false),
    onMouseEnter: showTooltip,
    onMouseLeave: () => setTooltipOpen(false),
    closeSheet: () => setSheetOpen(false),
  };
}

/** Props for {@link BylineButton}. */
interface BylineButtonProps {
  author: BylineModel['authors'][number];
  index: number;
  dragging: boolean;
  symbols: string;
  tap: BylineTap;
}

/** The name button of one byline segment with superscripts and ORCID marker. */
function BylineButton({ author, index, dragging, symbols, tap }: BylineButtonProps): ReactNode {
  return (
    <button
      type="button"
      data-testid={`byline-author-${index}`}
      data-press-index={index}
      data-dragging={dragging || undefined}
      aria-describedby={tap.tooltipOpen ? `byline-tooltip-${index}` : undefined}
      onPointerDown={tap.onPointerDown}
      onClick={tap.onClick}
      onFocus={tap.onFocus}
      onBlur={tap.onBlur}
      onMouseEnter={tap.onMouseEnter}
      onMouseLeave={tap.onMouseLeave}
      className={`min-h-11 touch-none rounded px-0.5 hover:bg-hover${dragging ? ' opacity-50' : ''}`}
    >
      {author.name}
      {author.onBehalfOf && <span> {author.onBehalfOf}</span>}
      <sup data-testid={`byline-superscript-${index}`}>{author.superscript}{symbols}</sup>
      {author.orcid && (
        <Info aria-label={`ORCID ${author.orcid}`} data-testid={`byline-orcid-${index}`} className={ICON} />
      )}
    </button>
  );
}

/** One byline segment: name button, superscripts, ORCID marker, tooltip. */
function BylineName(
  { author, index, onOpen, dragging, filterClick }: {
    author: BylineModel['authors'][number];
    index: number;
    onOpen: (index: number) => void;
    dragging: boolean;
    filterClick: () => boolean;
  },
): ReactNode {
  const tap = useBylineTap(index, onOpen, filterClick);
  const symbols = (author.corresponding ? '*' : '')
    + (author.equal ? '†' : '')
    + (author.deceased ? '‡' : '');
  return (
    <span className="relative inline-block">
      <BylineButton author={author} index={index} dragging={dragging} symbols={symbols} tap={tap} />
      {tap.tooltipOpen && (
        <span data-testid="byline-tooltip">
          <AuthorTooltip author={author} id={`byline-tooltip-${index}`} />
        </span>
      )}
      {tap.sheetOpen && (
        <AuthorSheet
          author={author}
          onClose={tap.closeSheet}
          onEdit={() => {
            tap.closeSheet();
            onOpen(index);
          }}
        />
      )}
    </span>
  );
}

/**
 * The byline row and symbol footnotes of one model.
 *
 * @param props - See {@link BylineProps}.
 * @returns The rendered byline block.
 */
export function Byline({ model, authors, setAuthors, onOpenName }: BylineProps): ReactNode {
  const drag = usePressDrag({
    onReorder: (from, to) => {
      const next = authors.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setAuthors(next);
    },
  });
  return (
    <div
      className="mt-1 text-sm"
      data-testid="article-byline"
      onPointerDown={drag.onPointerDown}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
    >
      {model.authors.map((author, index) => (
        <span key={author.key}>
          {index > 0 && ', '}
          <BylineName
            author={author}
            index={index}
            onOpen={onOpenName}
            dragging={drag.dragging === index}
            filterClick={drag.filterClick}
          />
        </span>
      ))}
      <button
        type="button"
        data-testid="add-author"
        onClick={() => onOpenName(-1)}
        className={model.authors.length === 0 ? ADD_CTA : ADD_MUTED}
      >
        <Plus aria-hidden className="inline size-3.5" />
        Add author
      </button>
      <div className="mt-1 text-muted" data-testid="byline-footnotes">
        {model.footnotes.map((line) => <div key={line}>{line}</div>)}
      </div>
    </div>
  );
}
