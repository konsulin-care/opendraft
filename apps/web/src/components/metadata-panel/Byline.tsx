/**
 * Byline row of the article view: author name buttons with affiliation
 * superscripts, symbol flags, ORCID markers and hover/focus tooltip,
 * the numbered affiliation list, symbol-only footnotes and the
 * add-author button.
 *
 * The add-author button is a pulsing black CTA while the manuscript has
 * no authors and reverts to the muted default style once at least one
 * author exists.
 */
import { useState, type ReactNode } from 'react';
import { Info, Plus } from 'lucide-react';
import type { BylineModel } from './byline-model';

/** Icon size used by the ORCID marker. */
const ICON = 'inline size-4 shrink-0';

/** Props for {@link Byline}. */
export interface BylineProps {
  /** Derived byline model of the manuscript. */
  model: BylineModel;
  /** Open the author form; receives the author index, or -1 for a draft. */
  onOpenName: (index: number) => void;
}

/** Classes of the muted default add-author button. */
const ADD_MUTED = 'ml-2 min-h-11 rounded text-muted hover:bg-hover';

/** Classes of the pulsing black add-author CTA shown when there are no authors. */
const ADD_CTA = 'ml-2 min-h-11 rounded bg-black px-2 text-white animate-pulse hover:opacity-90';

/** Read-only tooltip shown on hover and focus of a byline name. */
function AuthorTooltip({ author, index }: { author: BylineModel['authors'][number]; index: number }): ReactNode {
  return (
    <span
      role="tooltip"
      id={`byline-tooltip-${index}`}
      data-testid="byline-tooltip"
      className="absolute left-0 top-full z-20 mt-1 w-64 rounded border bg-white p-2 text-sm shadow"
    >
      {author.email && <span className="block" data-testid="byline-tooltip-email">{author.email}</span>}
      {author.orcid && <span className="block" data-testid="byline-tooltip-orcid">{author.orcid}</span>}
      {author.roles.length > 0 && <span className="block text-muted">Roles: {author.roles.join(', ')}</span>}
    </span>
  );
}

/** One byline segment: name button, superscripts, ORCID marker, tooltip. */
function BylineName(
  { author, index, onOpen }: {
    author: BylineModel['authors'][number];
    index: number;
    onOpen: (index: number) => void;
  },
): ReactNode {
  const [open, setOpen] = useState(false);
  const symbols = (author.corresponding ? '*' : '')
    + (author.equal ? '†' : '')
    + (author.deceased ? '‡' : '');
  return (
    <span className="relative inline-block">
      <button
        type="button"
        data-testid={`byline-author-${index}`}
        aria-describedby={open ? `byline-tooltip-${index}` : undefined}
        onClick={() => onOpen(index)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="min-h-11 rounded px-0.5 hover:bg-hover"
      >
        {author.name}
        {author.onBehalfOf && <span> {author.onBehalfOf}</span>}
        <sup data-testid={`byline-superscript-${index}`}>{author.superscript}{symbols}</sup>
        {author.orcid && (
          <Info aria-label={`ORCID ${author.orcid}`} data-testid={`byline-orcid-${index}`} className={ICON} />
        )}
      </button>
      {open && <AuthorTooltip author={author} index={index} />}
    </span>
  );
}

/**
 * The byline row, numbered affiliations and footnotes of one model.
 *
 * @param props - See {@link BylineProps}.
 * @returns The rendered byline block.
 */
export function Byline({ model, onOpenName }: BylineProps): ReactNode {
  return (
    <div className="mt-1 text-sm" data-testid="article-byline">
      {model.authors.map((author, index) => (
        <span key={author.key}>
          {index > 0 && ', '}
          <BylineName author={author} index={index} onOpen={onOpenName} />
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
      <div className="mt-1 text-muted" data-testid="affiliation-list">
        {model.affiliations.map((entry) => (
          <div key={entry.id}>{entry.number}. {entry.name}</div>
        ))}
      </div>
      <div className="mt-1 text-muted" data-testid="byline-footnotes">
        {model.footnotes.map((line) => <div key={line}>{line}</div>)}
      </div>
    </div>
  );
}
