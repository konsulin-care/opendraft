/**
 * Article view of the manuscript metadata panel.
 *
 * An article-styled editor surface: borderless title, byline with
 * affiliation superscripts, symbols and hover/focus tooltip, numbered
 * affiliation list with footnotes, collaborators toggle, abstract,
 * CRediT contribution statement (only when roles exist) and the
 * publication details section collapsed by default.
 */
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Info, Plus } from 'lucide-react';
import type { MetadataAuthor } from './use-manuscript-metadata';
import { buildByline, type BylineModel, type AffiliationEntry } from './byline-model';
import { KeywordInput } from './KeywordInput';
import { SectionLabel } from './SectionLabel';
import { PublicationDetails } from './PublicationDetails';
import { AuthorsDialog } from './AuthorsDialog';

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
  /** Abstract text; '' before the first edit. */
  abstract?: string;
  /** Persist an abstract change to _abstract.yml. */
  setAbstract?: (text: string) => void;
  /** Keywords in file order. */
  keywords?: string[];
  /** Persist the deduped keyword array to _frontmatter.yml. */
  setKeywords?: (keywords: string[]) => void;
  /** Persist author edits to _author.yml; no-op when omitted. */
  setAuthors?: (authors: MetadataAuthor[]) => void;
  /** Persist affiliation registry edits to _author.yml; no-op when omitted. */
  setAffiliations?: (affiliations: AffiliationEntry[]) => void;
  /** Persist one _frontmatter.yml field; no-op when omitted. */
  setFrontmatterField?: (key: string, value: unknown) => void;
}

/** Icon size used by the section chevrons and the ORCID marker. */
const ICON = 'inline size-4 shrink-0';

/**
 * Borderless title input. Enter never inserts a newline; it moves the
 * focus to the next field instead.
 *
 * @param props - Title, setter and the Enter handler of the field.
 * @returns The title input element.
 */
function TitleField(
  { title, setTitle, onEnter }: Pick<ArticleViewProps, 'title' | 'setTitle'> & { onEnter(): void },
): ReactNode {
  return (
    <input
      data-testid="metadata-panel-title-input"
      aria-label="Manuscript title"
      value={title}
      placeholder="Untitled manuscript"
      onChange={(event) => setTitle(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onEnter();
        }
      }}
      className="min-h-11 w-full text-lg outline-none"
    />
  );
}

/** Grow a textarea to its content height. */
function autoGrow(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/** Count whitespace-separated words in a text. */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Small-caps label row with the abstract word count, above the textarea. */
function AbstractLabelRow({ abstract }: { abstract: string }): ReactNode {
  return (
    <div data-testid="abstract-label-row" className="flex items-baseline justify-between text-sm">
      <SectionLabel>Abstract</SectionLabel>
      <span data-testid="abstract-word-count" className="text-muted">
        {countWords(abstract)} words
      </span>
    </div>
  );
}

/** Borderless auto-grown abstract textarea with a guidance placeholder. */
function AbstractField(
  { abstract, setAbstract, textareaRef }: {
    abstract: string;
    setAbstract: (text: string) => void;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
  },
): ReactNode {
  return (
    <section className="mt-3">
      <AbstractLabelRow abstract={abstract} />
      <textarea
        ref={(el) => {
          textareaRef.current = el;
          autoGrow(el);
        }}
        data-testid="metadata-abstract"
        aria-label="Abstract"
        value={abstract}
        rows={2}
        placeholder="Summarize background, objectives, methods, results, and conclusions."
        onChange={(event) => {
          setAbstract(event.target.value);
          autoGrow(event.currentTarget);
        }}
        className="min-h-11 w-full resize-none text-sm outline-none"
      />
    </section>
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

/** The byline row, numbered affiliations and footnotes of one model. */
function Byline({ model, onOpenName }: { model: BylineModel; onOpenName: (index: number) => void }): ReactNode {
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
  abstract = '',
  setAbstract = () => {},
  keywords = [],
  setKeywords = () => {},
  setAuthors = () => {},
  setAffiliations,
  setFrontmatterField = () => {},
}: ArticleViewProps): ReactNode {
  const model = buildByline(authors, affiliations);
  const abstractRef = useRef<HTMLTextAreaElement>(null);
  // Dialog target: author index, or -1 for a new draft author.
  const [dialogIndex, setDialogIndex] = useState<number | null>(null);
  return (
    <div data-testid="metadata-article-view" className="py-3">
      <TitleField title={title} setTitle={setTitle} onEnter={() => abstractRef.current?.focus()} />
      <Byline model={model} onOpenName={setDialogIndex} />
      {model.collaborators.map((group) => (
        <CollaboratorItem key={group.key} group={group} />
      ))}
      <AbstractField abstract={abstract} setAbstract={setAbstract} textareaRef={abstractRef} />
      <section className="mt-3">
        <SectionLabel>Keywords</SectionLabel>
        <KeywordInput keywords={keywords} onChange={setKeywords} />
      </section>
      {model.hasContributions && (
        <section data-testid="author-contributions" className="mt-3">
          <SectionLabel>Contributions</SectionLabel>
          <ul className="text-sm text-muted">
            {model.contributions.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      )}
      <PublicationDetails frontmatter={frontmatter} setField={setFrontmatterField} />
      {dialogIndex !== null && (
        <AuthorsDialog authors={authors} setAuthors={setAuthors} affiliations={affiliations}
          setAffiliations={setAffiliations} initialIndex={dialogIndex >= 0 ? dialogIndex : undefined}
          startWithDraft={dialogIndex < 0} onClose={() => setDialogIndex(null)} />
      )}
    </div>
  );
}
