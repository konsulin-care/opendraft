/**
 * Article view of the manuscript metadata panel.
 *
 * An article-styled editor surface: borderless title, byline with
 * affiliation superscripts, symbols and hover/focus tooltip, numbered
 * affiliation list with footnotes, collaborators toggle, abstract,
 * CRediT contribution statement (only when roles exist) and the
 * publication details section collapsed by default.
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Info, Plus } from 'lucide-react';
import type { MetadataAuthor } from './use-manuscript-metadata';
import { buildByline, type BylineModel, type AffiliationEntry } from './byline-model';

/** Props for {@link ArticleView}. */
export interface ArticleViewProps {
  /** Manuscript title from _frontmatter.yml. */
  title: string;
  /** Author entries in authorship order. */
  authors: MetadataAuthor[];
  /** Affiliation registry entries for the numbered list. */
  affiliations?: AffiliationEntry[];
  /** Frontmatter fields shown in Publication details. */
  frontmatter?: Record<string, unknown>;
  /** Persist a title change to _frontmatter.yml. */
  setTitle: (title: string) => void;
}

/** Icon size used by the section chevrons and the ORCID marker. */
const ICON = 'inline size-4 shrink-0';

/**
 * Borderless auto-grown-free title field.
 *
 * @param props - See {@link ArticleViewProps}.
 * @returns The title input element.
 */
function TitleField({ title, setTitle }: Pick<ArticleViewProps, 'title' | 'setTitle'>): ReactNode {
  return (
    <input
      data-testid="metadata-panel-title-input"
      aria-label="Manuscript title"
      value={title}
      placeholder="Untitled manuscript"
      onChange={(event) => setTitle(event.target.value)}
      className="min-h-11 w-full text-lg outline-none"
    />
  );
}

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
  { author, index }: { author: BylineModel['authors'][number]; index: number },
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

/** The byline row, numbered affiliations and footnotes of one model. */
function Byline({ model }: { model: BylineModel }): ReactNode {
  return (
    <div className="mt-1 text-sm" data-testid="article-byline">
      {model.authors.map((author, index) => (
        <span key={author.key}>
          {index > 0 && ', '}
          <BylineName author={author} index={index} />
        </span>
      ))}
      <button
        type="button"
        data-testid="add-author"
        className="ml-2 min-h-11 rounded text-muted hover:bg-hover"
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

/** Collapsible collaborators list of one group author. */
function CollaboratorItem({ group }: { group: BylineModel['collaborators'][number] }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-sm">
      <button
        type="button"
        data-testid="collaborators-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="min-h-11 rounded text-left hover:bg-hover"
      >
        Collaborators: {group.name} ({group.count})
      </button>
      {open && (
        <ul data-testid="collaborators-list" className="ml-4 list-disc text-muted">
          {group.members.map((member) => <li key={member}>{member}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Read-only field of the publication details section. */
function DetailField({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div>
      <span className="text-muted">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

/** Collapsed-by-default publication details section. */
function PublicationDetails(
  { frontmatter }: { frontmatter: Record<string, unknown> },
): ReactNode {
  const [open, setOpen] = useState(false);
  const text = (key: string): string | null =>
    typeof frontmatter[key] === 'string' ? frontmatter[key] as string : null;
  return (
    <section className="mt-3">
      <button
        type="button"
        data-testid="publication-details-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-1 rounded font-medium hover:bg-hover"
      >
        {open
          ? <ChevronDown aria-hidden className={ICON} />
          : <ChevronRight aria-hidden className={ICON} />}
        Publication details
      </button>
      {open && (
        <div data-testid="publication-details-content" className="ml-1 space-y-1">
          {text('date') && <DetailField label="Date" value={text('date') as string} />}
          {text('license') && <DetailField label="License" value={text('license') as string} />}
          {text('copyright') && <DetailField label="Copyright" value={text('copyright') as string} />}
          {text('funding') && <DetailField label="Funding" value={text('funding') as string} />}
        </div>
      )}
    </section>
  );
}

/**
 * Article-styled manuscript metadata view.
 *
 * @param props - See {@link ArticleViewProps}.
 * @returns The rendered article view.
 */
export function ArticleView({
  title,
  authors,
  affiliations = [],
  frontmatter = {},
  setTitle,
}: ArticleViewProps): ReactNode {
  const model = buildByline(authors, affiliations);
  return (
    <div data-testid="metadata-article-view" className="px-4 py-3">
      <TitleField title={title} setTitle={setTitle} />
      <Byline model={model} />
      {model.collaborators.map((group) => (
        <CollaboratorItem key={group.key} group={group} />
      ))}
      {model.hasContributions && (
        <section data-testid="author-contributions" className="mt-3">
          <h3 className="font-medium">Author contributions</h3>
          <ul className="text-sm text-muted">
            {model.contributions.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      )}
      <PublicationDetails frontmatter={frontmatter} />
    </div>
  );
}
