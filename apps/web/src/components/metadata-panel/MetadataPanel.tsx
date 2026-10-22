import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type { PublishIssue } from '@opendraft/schema';
import { useManuscriptMetadata, type MetadataAuthor, type UseManuscriptMetadataResult } from './use-manuscript-metadata';
import { NARROW_QUERY, useMediaQuery } from '../../hooks/use-media-query';
import { ArticleView } from './ArticleView';
import { AuthorsDialog } from './AuthorsDialog';
import { ValidationBadge, issueFocusTarget, publishIssues } from './ValidationBadge';

/** localStorage key prefix for the per-project collapsed state. */
const STORAGE_PREFIX = 'opendraft:metadata-panel';

/** Props for {@link MetadataPanel}. */
export interface MetadataPanelProps {
  /** Workspace the manuscript metadata is read from. */
  workspace: WorkspaceAdapter | null;
  /** Repo-relative manuscript directory, or null when the file is outside one. */
  manuscriptRoot: string | null;
  /** Project identifier used to persist the collapsed state per project. */
  projectKey: string;
  /** Editor scroll container focused when Esc collapses the panel. */
  editorFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * localStorage key holding the collapsed state of one project's panel.
 *
 * @param projectKey - Project identifier (registry id).
 * @returns The storage key for the project.
 */
export function metadataPanelStorageKey(projectKey: string): string {
  return `${STORAGE_PREFIX}:${projectKey}`;
}

/**
 * Extract the manuscript root from an active file path.
 *
 * @param path - Repo-relative path of the active file.
 * @returns `manuscripts/<id>` for files under a manuscript, else null.
 */
export function manuscriptRootFromPath(path: string): string | null {
  const match = /^manuscripts\/([^/]+)\/.+/.exec(path);
  return match ? `manuscripts/${match[1]}` : null;
}

/**
 * Derive an author's display name: literal for groups, otherwise
 * given then family (with optional particle and suffix).
 *
 * @param author - Author entry from _author.yml.
 * @returns The byline display name, or '' when no name is present.
 */
export function authorBylineName(author: MetadataAuthor): string {
  const name = author.name;
  if (typeof name === 'string') return name;
  if (typeof name !== 'object' || name === null || Array.isArray(name)) return '';
  const structured = name as Record<string, unknown>;
  if (typeof structured.literal === 'string') return structured.literal;
  return [structured.given, structured.particle, structured.family, structured.suffix]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
}

/**
 * Resolve the initial expanded state of the panel. A stored preference
 * always wins; without one, an untitled manuscript starts expanded.
 *
 * @param title - Current manuscript title ('' when missing).
 * @param stored - Persisted state ('expanded' | 'collapsed') or null.
 * @returns Whether the panel starts expanded.
 */
export function initialExpanded(title: string, stored: string | null): boolean {
  if (stored === 'expanded') return true;
  if (stored === 'collapsed') return false;
  return title.trim() === '';
}

/** Read the persisted state for a project; null when absent or unreadable. */
function readStoredState(projectKey: string): string | null {
  try {
    return window.localStorage.getItem(metadataPanelStorageKey(projectKey));
  } catch {
    return null;
  }
}

/** Per-project expanded decision held in state (internal). */
interface ExpandedDecision {
  key: string;
  expanded: boolean;
}

/**
 * Collapsed/expanded state decided during render once the metadata has
 * loaded, persisted per project in localStorage. Deciding in render
 * guarantees no collapsed frame escapes for an expanded panel.
 *
 * @param projectKey - Project identifier used for the storage key.
 * @param title - Current manuscript title.
 * @param loaded - Whether the metadata load has settled.
 * @returns The expanded flag and a persisting setter.
 */
function useExpandedState(
  projectKey: string,
  title: string,
  loaded: boolean,
): [boolean, (next: boolean) => void] {
  const [decision, setDecision] = useState<ExpandedDecision | null>(null);
  if (loaded && (decision === null || decision.key !== projectKey)) {
    // Render-phase adjustment: React re-runs before committing, so no
    // intermediate render with the wrong state escapes.
    setDecision({
      key: projectKey,
      expanded: initialExpanded(title, readStoredState(projectKey)),
    });
  }
  const setPersisted = useCallback((next: boolean) => {
    setDecision({ key: projectKey, expanded: next });
    try {
      window.localStorage.setItem(
        metadataPanelStorageKey(projectKey),
        next ? 'expanded' : 'collapsed',
      );
    } catch {
      // Storage unavailable: keep the state session-only.
    }
  }, [projectKey]);
  return [decision?.key === projectKey ? decision.expanded : false, setPersisted];
}

/** Props for the collapsed pinned bar (internal). */
interface PinnedBarProps {
  title: string;
  byline: string;
  expanded: boolean;
  narrow: boolean;
  badge?: ReactNode;
  onToggle: () => void;
}

/**
 * Pinned collapsed bar: title, byline and chevron toggle, closed off by
 * the 1px hairline separator below it.
 *
 * @param props - See {@link PinnedBarProps}.
 * @returns The bar and separator elements.
 */
function PinnedBar({ title, byline, expanded, narrow, badge, onToggle }: PinnedBarProps): ReactNode {
  return (
    <>
      <div className="flex items-center gap-2 py-2" data-testid="metadata-panel-bar">
        <div className="min-w-0 flex-1">
          {!expanded && (
            <>
              <div data-testid="metadata-panel-bar-title" className={narrow ? 'line-clamp-2' : 'truncate'}>
                {title || 'Untitled manuscript'}
              </div>
              {byline && (
                <div className="truncate text-sm text-muted" data-testid="metadata-panel-byline">{byline}</div>
              )}
            </>
          )}
        </div>
        {badge}
        <button
          type="button"
          data-testid="metadata-panel-toggle"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse manuscript metadata' : 'Expand manuscript metadata'}
          onClick={onToggle}
          className="flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-hover"
        >
          {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </button>
      </div>
      <div data-testid="metadata-panel-separator" className="h-px bg-secondary" />
    </>
  );
}

/**
 * Issue-selection focus state: the author index the dialog opens on and
 * the field focused once the render exposing it has committed.
 *
 * @param expanded - Expanded flag the focus effect re-runs against.
 * @param setExpanded - Panel setter; selecting an issue expands first.
 * @returns The dialog index, the issue selector and the dialog close.
 */
function useIssueFocus(expanded: boolean, setExpanded: (next: boolean) => void): { dialogIndex: number | null; select(issue: PublishIssue): void; close(): void } {
  const [dialogIndex, setDialogIndex] = useState<number | null>(null);
  const [focusField, setFocusField] = useState<string | null>(null);
  // Focus a field once the render that exposes it has committed.
  useEffect(() => {
    if (!focusField) return;
    const field = document.querySelector<HTMLElement>(`[data-testid="${focusField}"]`);
    if (!field) return;
    field.focus();
    setFocusField(null);
  }, [focusField, dialogIndex, expanded]);
  const select = useCallback((issue: PublishIssue) => {
    setExpanded(true);
    const target = issueFocusTarget(issue.path);
    if (target.index !== null) setDialogIndex(target.index);
    if (target.focus) setFocusField(target.focus);
  }, [setExpanded]);
  const close = useCallback(() => setDialogIndex(null), []);
  return { dialogIndex, select, close };
}

/** Props for {@link PanelBody}. */
interface PanelBodyProps {
  meta: UseManuscriptMetadataResult;
  expanded: boolean;
  dialogIndex: number | null;
  onClose(): void;
}

/**
 * Animated panel body: the article view plus the authors dialog opened
 * on the author an issue pointed at. A grid-rows wrapper (0fr <-> 1fr)
 * animates open/close; collapsed it is aria-hidden and inert.
 *
 * @param props - See {@link PanelBodyProps}.
 * @returns The animating body wrapper element.
 */
function PanelBody({ meta, expanded, dialogIndex, onClose }: PanelBodyProps): ReactNode {
  const { frontmatter } = meta;
  const keywords = useMemo(() => (Array.isArray(frontmatter.keywords) ? frontmatter.keywords : []) as string[], [frontmatter.keywords]);
  return (
    <div data-testid="metadata-panel-body" aria-hidden={!expanded || undefined} inert={!expanded}
      className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div data-testid={expanded ? 'metadata-panel-expanded' : undefined} className="min-h-0 overflow-hidden">
        <ArticleView
          title={meta.title} authors={meta.authors} affiliations={meta.affiliations}
          frontmatter={frontmatter} setTitle={meta.setTitle} abstract={meta.abstract}
          setAbstract={meta.setAbstract} keywords={keywords}
          setKeywords={(next) => meta.setFrontmatterField('keywords', next)}
          setAuthors={meta.setAuthors} setAffiliations={meta.setAffiliations}
          setFrontmatterField={meta.setFrontmatterField}
        />
        {dialogIndex !== null && (
          <AuthorsDialog authors={meta.authors} setAuthors={meta.setAuthors}
            affiliations={meta.affiliations} setAffiliations={meta.setAffiliations}
            initialIndex={dialogIndex} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/**
 * Manuscript metadata panel inside the editor scroll container: pinned
 * collapsed bar over the expanded article editor, persisted per project;
 * Esc collapses it and refocuses the editor.
 *
 * @param props - See {@link MetadataPanelProps}.
 * @returns The panel section, or null when outside a loaded manuscript.
 */
export function MetadataPanel({
  workspace, manuscriptRoot, projectKey, editorFocusRef,
}: MetadataPanelProps): ReactNode {
  const meta = useManuscriptMetadata(workspace, manuscriptRoot);
  const { loaded, title, authors, affiliations, abstract, frontmatter } = meta;
  const narrow = useMediaQuery(NARROW_QUERY);
  const [expanded, setExpanded] = useExpandedState(projectKey, title, loaded);
  const issues = useMemo(() => publishIssues({ title, authors, affiliations, abstract, frontmatter }),
    [title, authors, affiliations, abstract, frontmatter]);
  const byline = useMemo(() => authors.map(authorBylineName).filter(Boolean).join(', '), [authors]);
  const issueFocus = useIssueFocus(expanded, setExpanded);
  const toggle = useCallback(() => setExpanded(!expanded), [expanded, setExpanded]);
  const openIssues = useCallback(() => setExpanded(true), [setExpanded]);
  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    setExpanded(false);
    editorFocusRef?.current?.focus();
  }, [editorFocusRef, setExpanded]);

  if (!manuscriptRoot || !loaded) return null;

  // Below 640px the expanded panel is a full-screen sheet.
  const sheet = expanded && narrow;
  return (
    <section
      data-testid="metadata-panel"
      aria-label="Manuscript metadata"
      onKeyDown={onKeyDown}
      role={sheet ? 'dialog' : undefined}
      aria-modal={sheet ? true : undefined}
      className={sheet ? 'fixed inset-0 z-30 flex flex-col overflow-y-auto bg-white' : 'sticky top-0 z-10 bg-white'}
    >
      <PinnedBar title={title} byline={narrow ? `${authors.length} authors` : byline}
        expanded={expanded} narrow={narrow} onToggle={toggle}
        badge={<ValidationBadge issues={issues} onSelect={issueFocus.select} onOpen={openIssues} />} />
      <PanelBody meta={meta} expanded={expanded} dialogIndex={issueFocus.dialogIndex} onClose={issueFocus.close} />
    </section>
  );
}
