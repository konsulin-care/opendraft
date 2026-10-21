import {
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { useManuscriptMetadata, type MetadataAuthor } from './use-manuscript-metadata';
import { NARROW_QUERY, useMediaQuery } from '../../hooks/use-media-query';

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

/** Per-project expanded decision held in state. */
interface ExpandedDecision {
  /** Project the decision belongs to. */
  key: string;
  /** Chosen expanded flag. */
  expanded: boolean;
}

/**
 * Collapsed/expanded state, decided during render once the metadata has
 * loaded and persisted per project in localStorage. Deciding in render
 * (rather than a post-commit effect) guarantees the commit that first
 * shows the panel already carries the settled state, so callers never
 * observe a collapsed frame for an expanded panel.
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
    // Render-phase state adjustment: React re-runs this component before
    // committing, so no intermediate render with the wrong state escapes.
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

/** Props for the expanded article stub (title input slot). */
interface ExpandedProps {
  /** Current manuscript title. */
  title: string;
  /** Persist a title change to _frontmatter.yml. */
  setTitle: (title: string) => void;
}

/**
 * Expanded body of the panel. D2 ships the title input slot; the full
 * article view lands with the later metadata-panel behaviors.
 *
 * @param props - See {@link ExpandedProps}.
 */
function ExpandedSection({ title, setTitle }: ExpandedProps): ReactNode {
  return (
    <div data-testid="metadata-panel-expanded" className="px-4 py-3">
      <input
        data-testid="metadata-panel-title-input"
        aria-label="Manuscript title"
        value={title}
        placeholder="Untitled manuscript"
        onChange={(event) => setTitle(event.target.value)}
        className="min-h-11 w-full text-lg outline-none"
      />
    </div>
  );
}

/** Props for the collapsed pinned bar. */
interface PinnedBarProps {
  /** Current manuscript title ('' shows the placeholder). */
  title: string;
  /** Byline text: names, or 'N authors' on narrow viewports. */
  byline: string;
  /** Whether the panel body is currently expanded. */
  expanded: boolean;
  /** Whether the viewport is below the 640px breakpoint. */
  narrow: boolean;
  /** Toggles the expanded state. */
  onToggle: () => void;
}

/**
 * Pinned collapsed bar: title, byline and chevron toggle, closed off by
 * the 1px hairline separator below it.
 *
 * @param props - See {@link PinnedBarProps}.
 * @returns The bar and separator elements.
 */
function PinnedBar({ title, byline, expanded, narrow, onToggle }: PinnedBarProps): ReactNode {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2" data-testid="metadata-panel-bar">
        <div className="min-w-0 flex-1">
          <div
            data-testid="metadata-panel-bar-title"
            className={narrow ? 'line-clamp-2' : 'truncate'}
          >
            {title || 'Untitled manuscript'}
          </div>
          {byline && (
            <div className="truncate text-sm text-muted" data-testid="metadata-panel-byline">
              {byline}
            </div>
          )}
        </div>
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
 * Manuscript metadata panel rendered inside the editor scroll container.
 * Shows a pinned collapsed bar (title, byline, chevron toggle, hairline
 * separator) and expands into the article editor; the state is persisted
 * per project and Esc collapses the panel and refocuses the editor.
 *
 * @param props - See {@link MetadataPanelProps}.
 */
export function MetadataPanel({
  workspace,
  manuscriptRoot,
  projectKey,
  editorFocusRef,
}: MetadataPanelProps): ReactNode {
  const { loaded, title, authors, setTitle } = useManuscriptMetadata(workspace, manuscriptRoot);
  const narrow = useMediaQuery(NARROW_QUERY);
  const [expanded, setExpanded] = useExpandedState(projectKey, title, loaded);

  const byline = useMemo(
    () => authors.map(authorBylineName).filter(Boolean).join(', '),
    [authors],
  );
  const toggle = useCallback(
    () => setExpanded(!expanded),
    [expanded, setExpanded],
  );
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
      className={sheet
        ? 'fixed inset-0 z-30 flex flex-col overflow-y-auto bg-white'
        : 'sticky top-0 z-10 bg-white'}
    >
      <PinnedBar
        title={title}
        byline={narrow ? `${authors.length} authors` : byline}
        expanded={expanded}
        narrow={narrow}
        onToggle={toggle}
      />
      {expanded && <ExpandedSection title={title} setTitle={setTitle} />}
    </section>
  );
}
