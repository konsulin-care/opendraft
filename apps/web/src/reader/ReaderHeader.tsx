/**
 * Reader header built on the shared responsive header frame.
 *
 * The header follows the editor's contract: below md the title collapses into
 * a trigger that opens the reader details panel (repository link plus the
 * manuscript picker, since the inline switcher is hidden there), and from md
 * up it shows the inline title with its switcher. The leading book mark links
 * back to the editor, and the main reader action sits before the account menu.
 */

import type { ReactNode } from 'react';
import { BookOpenText } from 'lucide-react';
import type { BffSession } from '../github/bff-client';
import { HeaderFrame } from '../components/header/HeaderFrame';
import { ManuscriptSwitcher } from '../components/header/ManuscriptSwitcher';
import type { ManuscriptSwitcherOption } from '../components/header/ManuscriptSwitcher';
import { RepoSubtitle } from '../components/header/RepoSubtitle';
import { TitleTrigger } from '../components/header/TitleTrigger';
import type { HeaderOverlays } from '../components/header/use-header-overlays';
import { UserMenu } from '../components/header/UserMenu';
import { ReaderDetailsPanel } from './ReaderDetailsPanel';

/** Props for {@link ReaderHeader}. */
export interface ReaderHeaderProps {
  /** Signed-in session, or null for an anonymous visitor. */
  session: BffSession | null;
  /** Reader path returned to after sign-in, install or sign-out. */
  returnTo: string;
  /** Sign-out handler invoked when the session owner clicks `Sign out`. */
  onLogout: () => void;
  /** Whether GitHub login is configured; defaults to true. */
  loginEnabled?: boolean;
  /** Selected manuscript title; defaults to "All manuscripts". */
  title?: string;
  /** Manuscripts offered by the switcher. */
  manuscripts?: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  selectedId?: string;
  /** Called with the id of the manuscript chosen in the switcher. */
  onSelect?: (id: string) => void;
  /** When given, adds an "All manuscripts" entry to the switcher. */
  onSelectAll?: () => void;
  /** Main reader action, shown before the account menu. */
  action?: ReactNode;
}

const ICON_LINK =
  'inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/** Id of the details panel controlled by the reader title trigger. */
const DETAILS_PANEL_ID = 'reader-details-panel';

/** Book mark linking the reader back to the editor. */
function EditorLink() {
  return (
    <a href="/" aria-label="Open editor" title="Open editor" className={ICON_LINK}>
      <BookOpenText className="h-5 w-5" aria-hidden="true" />
    </a>
  );
}

/** Props for {@link CompactTitle}. */
interface CompactTitleProps {
  /** Title shown below md. */
  heading: string;
  /** Overlay state driving the panel. */
  overlays: HeaderOverlays;
}

/**
 * Title trigger shown below md, opening the reader details panel.
 *
 * @param props - See {@link CompactTitleProps}.
 * @returns The reader's title trigger.
 */
function CompactTitle({ heading, overlays }: CompactTitleProps) {
  return (
    <TitleTrigger
      title={heading}
      open={overlays.view !== 'closed'}
      panelId={DETAILS_PANEL_ID}
      onToggle={overlays.toggleDetails}
      triggerRef={overlays.triggerRef}
    />
  );
}

/** Props for {@link WideTitle}. */
interface WideTitleProps {
  /** Title shown from md up. */
  heading: string;
  /** Whether the switcher is offered. */
  canSwitch: boolean;
  /** Manuscripts offered by the switcher. */
  manuscripts: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  selectedId?: string;
  /** Called with the id chosen in the switcher. */
  onSelect?: (id: string) => void;
  /** When given, adds an "All manuscripts" entry to the switcher. */
  onSelectAll?: () => void;
}

/**
 * Inline title row shown from md up.
 *
 * @param props - See {@link WideTitleProps}.
 * @returns The title text and its optional switcher.
 */
function WideTitle({ heading, canSwitch, manuscripts, selectedId, onSelect, onSelectAll }: WideTitleProps) {
  return (
    <>
      <span className="truncate text-sm font-semibold text-gray-900">{heading}</span>
      {canSwitch && onSelect !== undefined ? (
        <ManuscriptSwitcher
          manuscripts={manuscripts}
          currentId={selectedId}
          onSelect={onSelect}
          onSelectAll={onSelectAll}
        />
      ) : null}
    </>
  );
}

/** Props for {@link ReaderPanelSlot}. */
interface ReaderPanelSlotProps {
  /** Overlay state driving the panel. */
  overlays: HeaderOverlays;
  /** Published repository slug, or an empty string when local. */
  repo: string;
  /** Manuscripts offered by the picker. */
  manuscripts: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  selectedId?: string;
  /** Called with the id chosen in the picker. */
  onSelect?: (id: string) => void;
  /** When given, adds an "All manuscripts" entry to the picker. */
  onSelectAll?: () => void;
}

/**
 * Details panel slot: nothing while closed, the panel while open.
 *
 * Choosing a manuscript closes every overlay, so the header returns to its
 * collapsed state once the selection navigated.
 *
 * @param props - See {@link ReaderPanelSlotProps}.
 * @returns The details panel, or null while closed.
 */
function ReaderPanelSlot({
  overlays,
  repo,
  manuscripts,
  selectedId,
  onSelect,
  onSelectAll,
}: ReaderPanelSlotProps) {
  if (overlays.view === 'closed') return null;
  const pick = (): void => overlays.pick();
  return (
    <ReaderDetailsPanel
      id={DETAILS_PANEL_ID}
      onClose={overlays.dismiss}
      repo={repo}
      manuscripts={manuscripts}
      selectedId={selectedId}
      onSelect={(id) => {
        onSelect?.(id);
        pick();
      }}
      onSelectAll={
        onSelectAll === undefined
          ? undefined
          : () => {
              onSelectAll();
              pick();
            }
      }
    />
  );
}

/**
 * Render the reader header with title, switcher, action and account menu.
 *
 * @param props - See {@link ReaderHeaderProps}.
 * @returns The shared header frame configured for the reader.
 */
export function ReaderHeader({
  session,
  returnTo,
  onLogout,
  loginEnabled = true,
  title,
  manuscripts = [],
  selectedId,
  onSelect,
  onSelectAll,
  action,
}: ReaderHeaderProps) {
  const heading = title ?? 'All manuscripts';
  const repo = readerRepoName(returnTo);
  const canSwitch = onSelect !== undefined && manuscripts.length > 1;
  const picker = { repo, manuscripts, selectedId, onSelect, onSelectAll };

  return (
    <HeaderFrame
      testId="reader-header"
      leading={<EditorLink />}
      compact={(overlays) => <CompactTitle heading={heading} overlays={overlays} />}
      wide={
        <WideTitle
          heading={heading}
          canSwitch={canSwitch}
          manuscripts={manuscripts}
          selectedId={selectedId}
          onSelect={onSelect}
          onSelectAll={onSelectAll}
        />
      }
      subtitle={<PublishedSubtitle repo={repo} />}
      action={action}
      userMenu={
        <UserMenu
          session={session}
          returnTo={returnTo}
          onLogout={onLogout}
          loginEnabled={loginEnabled}
        />
      }
      panel={(overlays) => <ReaderPanelSlot overlays={overlays} {...picker} />}
    />
  );
}

/**
 * Render the `Published at` subtitle for an optional repository slug.
 *
 * @param props - The repository slug, or an empty string for a local project.
 * @returns A plain prefix for local projects, otherwise a linked repository.
 */
function PublishedSubtitle({ repo }: { repo: string }) {
  if (repo === '') return <RepoSubtitle prefix="Published at" />;
  return (
    <RepoSubtitle prefix="Published at" repo={repo} href={`https://github.com/${repo}`} />
  );
}

/**
 * Extract `owner/repo` from a reader path.
 *
 * @param path - Reader path such as `/{owner}/{repo}[/tree/{ref}]`.
 * @returns The repository name, or the trimmed path when it has no owner.
 */
function readerRepoName(path: string): string {
  const [owner = '', repo = ''] = path.split('?')[0].split('/').filter(Boolean);
  return repo === '' ? owner : `${owner}/${repo}`;
}

export default ReaderHeader;
