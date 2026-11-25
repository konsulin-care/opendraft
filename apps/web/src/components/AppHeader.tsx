import {
  BookOpenText,
  Check,
  CircleAlert,
  LoaderCircle,
  SquareArrowUpRightExit,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import type { ProjectSource } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { PROJECT_DRAWER_ID } from './project-drawer/ProjectDrawer';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';
import { HeaderShell } from './header/HeaderShell';
import { ManuscriptSwitcher } from './header/ManuscriptSwitcher';
import type { ManuscriptSwitcherOption } from './header/ManuscriptSwitcher';
import { repoSubtitle } from './header/repo-subtitle';
import { UserMenu } from './header/UserMenu';
import { InlineEditField } from './InlineEditField';

/** Autosave state shown in the header. */
export type SaveStatus = 'saved' | 'saving' | 'error';

const SAVE_STATE: Record<SaveStatus, { label: string; Icon: LucideIcon; iconClass: string }> = {
  saving: { label: 'Saving', Icon: LoaderCircle, iconClass: 'animate-spin text-gray-500' },
  saved: { label: 'Saved', Icon: Check, iconClass: 'text-green-700' },
  error: { label: 'Save failed', Icon: CircleAlert, iconClass: 'text-red-700' },
};

const ICON_BUTTON =
  'inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/** Inert sign-out handler for headers rendered without a session shell. */
const NOOP_LOGOUT = (): void => {};

/** Props for {@link SaveIndicator}. */
interface SaveIndicatorProps {
  /** Current autosave state. */
  status: SaveStatus;
}

/** Autosave state with icon and label, announced politely to screen readers. */
function SaveIndicator({ status }: SaveIndicatorProps) {
  const { label, Icon, iconClass } = SAVE_STATE[status];
  return (
    <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-1 text-xs text-gray-600">
      <Icon className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Props for {@link HeaderActions}. */
interface HeaderActionsProps {
  /** Main action shown before the mobile overflow menu. */
  action?: ReactNode;
}

/** Right-hand header controls: the main action slot and the overflow menu. */
function HeaderActions({ action }: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {action}
      <HeaderOverflowMenu />
    </div>
  );
}

/** Props for {@link DrawerToggle}. */
interface DrawerToggleProps {
  /** Whether the project drawer is currently open. */
  sidebarOpen: boolean;
  /** Called when the toggle is activated. */
  onToggle?: () => void;
  /** Receives the button element so the drawer can return focus to it. */
  toggleButtonRef?: RefObject<HTMLButtonElement | null>;
}

/** Drawer toggle shown as the header's leading control. */
function DrawerToggle({ sidebarOpen, onToggle, toggleButtonRef }: DrawerToggleProps) {
  return (
    <button
      type="button"
      aria-label="OpenDraft"
      title="OpenDraft"
      aria-expanded={sidebarOpen}
      aria-controls={PROJECT_DRAWER_ID}
      onClick={onToggle}
      ref={toggleButtonRef}
      className={`${ICON_BUTTON} h-9`}
    >
      <BookOpenText className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

/** Props for {@link HeaderTitle}. */
interface HeaderTitleProps {
  /** Display name of the open manuscript, falling back to the dir name. */
  title?: string;
  /** Manuscripts offered by the switcher. */
  manuscripts?: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  currentId?: string;
  /** Called with the trimmed title when the user renames the manuscript. */
  onRenameManuscript?: (name: string) => void | Promise<void>;
  /** Called with the id of the manuscript chosen in the switcher. */
  onSelect?: (id: string) => void;
  /** Adds an "All manuscripts" entry to the switcher when given. */
  onSelectAll?: () => void;
}

/** Header title column: the inline-editable title next to the switcher. */
function HeaderTitle({
  title,
  manuscripts,
  currentId,
  onRenameManuscript,
  onSelect,
  onSelectAll,
}: HeaderTitleProps) {
  return (
    <span
      data-testid="header-title"
      className="flex min-w-0 items-center gap-1 text-left"
    >
      {title !== undefined && (
        <InlineEditField
          value={title}
          label="Manuscript name"
          testId="manuscript-title"
          onSave={onRenameManuscript}
        />
      )}
      {onSelect !== undefined && (
        <ManuscriptSwitcher
          manuscripts={manuscripts ?? []}
          currentId={currentId}
          onSelect={onSelect}
          onSelectAll={onSelectAll}
        />
      )}
    </span>
  );
}

/** Props for {@link RepoSubtitle}. */
interface RepoSubtitleProps {
  /** Plain-language location label. */
  prefix: string;
  /** Repository in `owner/repo` form. */
  repo?: string;
  /** GitHub URL of the repository. */
  href?: string;
}

/** Subtitle with a plain prefix and an optional linked repo and external icon. */
function RepoSubtitle({ prefix, repo, href }: RepoSubtitleProps) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span>{prefix}</span>
      {repo !== undefined && href !== undefined && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-0.5 text-black underline decoration-dashed underline-offset-2"
        >
          <span className="truncate">{repo}</span>
          <SquareArrowUpRightExit className="size-3 shrink-0" aria-hidden="true" />
        </a>
      )}
    </span>
  );
}

/** Account menu node for the header's trailing slot. */
function HeaderUserMenu(props: {
  session: BffSession | null;
  returnTo: string;
  onLogout: () => void;
  loginEnabled: boolean;
}) {
  return <UserMenu {...props} />;
}

/** Props for {@link AppHeader}. */
export interface AppHeaderProps {
  /** Display name of the open manuscript (line 1 of the title column). */
  manuscriptName?: string;
  /** Manuscript directory name; used when no display name is set. */
  manuscriptDir?: string;
  /** Source of the active project, used for the read-only subtitle. */
  source?: ProjectSource;
  /** Manuscripts offered by the title switcher. */
  manuscripts?: readonly ManuscriptSwitcherOption[];
  /** Id of the open manuscript. */
  manuscriptId?: string;
  /** Called with the trimmed title when the user renames the manuscript. */
  onRenameManuscript?: (name: string) => void | Promise<void>;
  /** Called with the id of the manuscript chosen in the switcher. */
  onSelectManuscript?: (id: string) => void;
  /** Adds an "All manuscripts" entry to the switcher when given. */
  onSelectAllManuscripts?: () => void;
  /** Current autosave state. */
  saveStatus: SaveStatus;
  /** Main action slot rendered before the account menu. */
  action?: ReactNode;
  /** Signed-in session, or null for a signed-out viewer. */
  session?: BffSession | null;
  /** Whether GitHub login is configured; defaults to true. */
  loginEnabled?: boolean;
  /** Sign-out handler for the account menu. */
  onLogout?: () => void;
  /** Relative path to reopen after sign-in or installation. */
  returnTo?: string;
  /** Called when the book button toggles the project drawer. */
  onToggleSidebar?: () => void;
  /** Whether the project drawer is currently open. */
  sidebarOpen?: boolean;
  /** Receives the book button element so the drawer can return focus to it. */
  toggleButtonRef?: RefObject<HTMLButtonElement | null>;
  /** @deprecated No longer rendered; kept so legacy callers still type-check. */
  fileName?: string;
  /** @deprecated Replaced by {@link AppHeaderProps.action}; ignored. */
  onCommit?: () => void;
  /** @deprecated The editor-mode system was removed; ignored. */
  mode?: 'wysiwyg' | 'source';
  /** @deprecated The editor-mode system was removed; ignored. */
  onSelectMode?: (mode: 'wysiwyg' | 'source') => void;
}

/**
 * Editor header built on the shared two-line shell: drawer toggle, editable
 * manuscript title with its switcher, read-only repo subtitle, autosave
 * state, main action and account menu.
 *
 * @param props - See {@link AppHeaderProps}.
 * @returns The editor header.
 */
export function AppHeader({
  manuscriptName,
  manuscriptDir,
  source,
  manuscripts,
  manuscriptId,
  onRenameManuscript,
  onSelectManuscript,
  onSelectAllManuscripts,
  saveStatus,
  action,
  session = null,
  loginEnabled = true,
  onLogout = NOOP_LOGOUT,
  returnTo = '/',
  onToggleSidebar,
  sidebarOpen = false,
  toggleButtonRef,
}: AppHeaderProps) {
  return (
    <div data-testid="app-header">
      <HeaderShell
        leading={
          <DrawerToggle
            sidebarOpen={sidebarOpen}
            onToggle={onToggleSidebar}
            toggleButtonRef={toggleButtonRef}
          />
        }
        title={
          <HeaderTitle
            title={manuscriptName ?? manuscriptDir}
            manuscripts={manuscripts}
            currentId={manuscriptId}
            onRenameManuscript={onRenameManuscript}
            onSelect={onSelectManuscript}
            onSelectAll={onSelectAllManuscripts}
          />
        }
        subtitle={source ? <RepoSubtitle {...repoSubtitle(source)} /> : undefined}
        extra={<SaveIndicator status={saveStatus} />}
        action={<HeaderActions action={action} />}
        userMenu={<HeaderUserMenu session={session} returnTo={returnTo} onLogout={onLogout} loginEnabled={loginEnabled} />}
      />
    </div>
  );
}
