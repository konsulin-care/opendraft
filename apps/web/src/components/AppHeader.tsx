import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpenText } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import type { ProjectSource } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import type { HeaderStatus } from '../hooks/draft-header-status';
import { PROJECT_DRAWER_ID } from './project-drawer/ProjectDrawer';
import { DetailsPanel } from './header/DetailsPanel';
import { HeaderShell } from './header/HeaderShell';
import { ManuscriptSwitcher } from './header/ManuscriptSwitcher';
import type { ManuscriptSwitcherOption } from './header/ManuscriptSwitcher';
import { RepoSubtitle } from './header/RepoSubtitle';
import { repoSubtitle } from './header/repo-subtitle';
import { TitleTrigger } from './header/TitleTrigger';
import { useOutsideClose } from './header/use-outside-close';
import { UserMenu } from './header/UserMenu';

/** Autosave state shown in the header. */
export type SaveStatus = 'saved' | 'saving' | 'error';

/** Id of the manuscript details panel controlled by the title trigger. */
const DETAILS_PANEL_ID = 'details-panel';

const ICON_BUTTON =
  'inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/** Inert sign-out handler for headers rendered without a session shell. */
const NOOP_LOGOUT = (): void => {};

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
  /** Whether the details panel is open. */
  open: boolean;
  /** Called when the title trigger is activated. */
  onToggle: () => void;
  /** Receives the trigger element so closing can return focus to it. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** Current autosave state. */
  saveStatus: SaveStatus;
  /** Draft status supplying the notice and attention dot. */
  status?: HeaderStatus;
  /** Manuscripts offered by the switcher. */
  manuscripts?: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  currentId?: string;
  /** Called with the id of the manuscript chosen in the switcher. */
  onSelect?: (id: string) => void;
  /** Adds an "All manuscripts" entry to the switcher when given. */
  onSelectAll?: () => void;
}

/**
 * Header title slot: the details trigger, its live status region and the
 * optional manuscript switcher.
 *
 * @param props - See {@link HeaderTitleProps}.
 * @returns The title trigger followed by the switcher when enabled.
 */
function HeaderTitle({
  title,
  open,
  onToggle,
  triggerRef,
  saveStatus,
  status,
  manuscripts,
  currentId,
  onSelect,
  onSelectAll,
}: HeaderTitleProps) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <TitleTrigger
        title={title}
        open={open}
        panelId={DETAILS_PANEL_ID}
        onToggle={onToggle}
        triggerRef={triggerRef}
        saveStatus={saveStatus}
        notice={status?.notice}
        attention={status?.attention}
      />
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

/** Account menu node for the header's trailing slot. */
function HeaderUserMenu(props: {
  session: BffSession | null;
  returnTo: string;
  onLogout: () => void;
  loginEnabled: boolean;
}) {
  return <UserMenu {...props} />;
}

/** Open state and refs of the manuscript details disclosure. */
interface DetailsDisclosure {
  open: boolean;
  toggle: () => void;
  close: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

function useDetailsDisclosure(sidebarOpen: boolean): DetailsDisclosure {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const close = useCallback((): void => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  const toggle = useCallback((): void => setOpen((value) => !value), []);

  useOutsideClose(open, containerRef, close);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);
  useEffect(() => {
    if (sidebarOpen) setOpen(false);
  }, [sidebarOpen]);

  return { open, toggle, close, containerRef, triggerRef };
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
  /** Draft status shown in the details panel and the trigger dot. */
  status?: HeaderStatus;
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

/** Props for {@link AppHeaderShell}. */
interface AppHeaderShellProps extends AppHeaderProps {
  disclosure: DetailsDisclosure;
}

function detailsPanel(
  props: AppHeaderShellProps,
  title: string | undefined,
) {
  if (!props.disclosure.open) return undefined;
  return (
    <DetailsPanel
      id={DETAILS_PANEL_ID}
      onClose={props.disclosure.close}
      name={title}
      onRename={props.onRenameManuscript}
      source={props.source}
      saveStatus={props.saveStatus}
      status={props.status}
    />
  );
}

function AppHeaderShell(props: AppHeaderShellProps) {
  const title = props.manuscriptName ?? props.manuscriptDir;
  return (
    <HeaderShell
      leading={
        <DrawerToggle
          sidebarOpen={props.sidebarOpen ?? false}
          onToggle={props.onToggleSidebar}
          toggleButtonRef={props.toggleButtonRef}
        />
      }
      title={
        <HeaderTitle
          title={title}
          open={props.disclosure.open}
          onToggle={props.disclosure.toggle}
          triggerRef={props.disclosure.triggerRef}
          saveStatus={props.saveStatus}
          status={props.status}
          manuscripts={props.manuscripts}
          currentId={props.manuscriptId}
          onSelect={props.onSelectManuscript}
          onSelectAll={props.onSelectAllManuscripts}
        />
      }
      subtitle={props.source ? <RepoSubtitle {...repoSubtitle(props.source)} /> : undefined}
      action={props.action}
      userMenu={
        <HeaderUserMenu
          session={props.session ?? null}
          returnTo={props.returnTo ?? '/'}
          onLogout={props.onLogout ?? NOOP_LOGOUT}
          loginEnabled={props.loginEnabled ?? true}
        />
      }
      panel={detailsPanel(props, title)}
    />
  );
}

/**
 * Editor header built on the shared two-line shell: drawer toggle, title
 * trigger with its live save status and switcher, read-only repo subtitle,
 * main action and account menu. Activating the title opens a details panel
 * with the editable manuscript name and the draft status.
 *
 * @param props - See {@link AppHeaderProps}.
 * @returns The editor header with its optional details panel.
 */
export function AppHeader(props: AppHeaderProps) {
  const disclosure = useDetailsDisclosure(props.sidebarOpen ?? false);
  return (
    <div data-testid="app-header" ref={disclosure.containerRef}>
      <AppHeaderShell {...props} disclosure={disclosure} />
    </div>
  );
}
