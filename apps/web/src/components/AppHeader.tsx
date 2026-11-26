import type { ReactNode, RefObject } from 'react';
import { BookOpenText } from 'lucide-react';
import type { ProjectSource } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import type { HeaderStatus } from '../hooks/draft-header-status';
import { PROJECT_DRAWER_ID } from './project-drawer/ProjectDrawer';
import { DetailsPanel } from './header/DetailsPanel';
import { HeaderShell } from './header/HeaderShell';
import { InlineEditField } from './InlineEditField';
import { ManuscriptPicker } from './header/ManuscriptPicker';
import { ManuscriptSwitcher } from './header/ManuscriptSwitcher';
import type { ManuscriptSwitcherOption } from './header/ManuscriptSwitcher';
import { RepoSubtitle } from './header/RepoSubtitle';
import { repoSubtitle } from './header/repo-subtitle';
import { TitleTrigger } from './header/TitleTrigger';
import { useHeaderOverlays } from './header/use-header-overlays';
import type { HeaderOverlays } from './header/use-header-overlays';
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
  /** Called with the trimmed name when the desktop field saves. */
  onRename?: (value: string) => void | Promise<void>;
  /** Manuscripts offered by the desktop switcher. */
  manuscripts?: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  currentId?: string;
  /** Called with the id chosen in the desktop switcher. */
  onSelect?: (id: string) => void;
}

/**
 * Header title slot in two CSS-switched variants: the details trigger below
 * `md`, and an inline-editable name with the manuscript switcher from `md` up.
 * Both variants live in the DOM; only one is visible per breakpoint.
 *
 * @param props - See {@link HeaderTitleProps}.
 * @returns The mobile trigger and the desktop inline title.
 */
function HeaderTitle({
  title,
  open,
  onToggle,
  triggerRef,
  saveStatus,
  status,
  onRename,
  manuscripts,
  currentId,
  onSelect,
}: HeaderTitleProps) {
  const canSwitch = (manuscripts?.length ?? 0) >= 2 && onSelect !== undefined;
  return (
    <>
      <span className="flex min-w-0 items-center gap-1 md:hidden">
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
      </span>
      <span className="hidden min-w-0 items-center gap-1 md:flex">
        {title !== undefined && (
          <InlineEditField
            value={title}
            label="Manuscript name"
            testId="manuscript-title-inline"
            onSave={onRename}
          />
        )}
        {canSwitch && (
          <ManuscriptSwitcher
            manuscripts={manuscripts ?? []}
            currentId={currentId}
            onSelect={onSelect}
          />
        )}
      </span>
    </>
  );
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
  /** Called with the id of the manuscript chosen in the picker. */
  onSelectManuscript?: (id: string) => void;
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
  overlays: HeaderOverlays;
}

/**
 * Pick the overlay surface for the current header view.
 *
 * @param props - Header props carrying the overlay state.
 * @param title - Resolved manuscript title shown in the details panel.
 * @returns The details panel, the manuscript picker, or null when closed.
 */
function panelSlot(props: AppHeaderShellProps, title: string | undefined): ReactNode {
  const { overlays } = props;
  if (overlays.view === 'closed') return null;

  if (overlays.view === 'picker') {
    return (
      <ManuscriptPicker
        manuscripts={props.manuscripts ?? []}
        currentId={props.manuscriptId}
        onPick={(id) => {
          overlays.pick();
          props.onSelectManuscript?.(id);
        }}
        onClose={overlays.dismiss}
      />
    );
  }

  const canSwitch =
    (props.manuscripts?.length ?? 0) >= 2 && props.onSelectManuscript !== undefined;
  return (
    <DetailsPanel
      id={DETAILS_PANEL_ID}
      onClose={overlays.dismiss}
      onOpenPicker={canSwitch ? overlays.openPicker : undefined}
      switchRef={canSwitch ? overlays.switchRef : undefined}
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
          open={props.overlays.view !== 'closed'}
          onToggle={props.overlays.toggleDetails}
          triggerRef={props.overlays.triggerRef}
          saveStatus={props.saveStatus}
          status={props.status}
          onRename={props.onRenameManuscript}
          manuscripts={props.manuscripts}
          currentId={props.manuscriptId}
          onSelect={props.onSelectManuscript}
        />
      }
      subtitle={props.source ? <RepoSubtitle {...repoSubtitle(props.source)} /> : undefined}
      action={props.action}
      userMenu={
        <UserMenu
          session={props.session ?? null}
          returnTo={props.returnTo ?? '/'}
          onLogout={props.onLogout ?? NOOP_LOGOUT}
          loginEnabled={props.loginEnabled ?? true}
        />
      }
      panel={<div className="md:hidden">{panelSlot(props, title)}</div>}
    />
  );
}

/**
 * Editor header built on the shared two-line shell: drawer toggle, title
 * trigger with its live save status, read-only repo subtitle, main action and
 * account menu. Activating the title opens a details panel with the editable
 * manuscript name and the draft status; from there a picker selects another
 * manuscript.
 *
 * @param props - See {@link AppHeaderProps}.
 * @returns The editor header with its optional overlay surface.
 */
export function AppHeader(props: AppHeaderProps) {
  const overlays = useHeaderOverlays(props.sidebarOpen ?? false);
  return (
    <div data-testid="app-header" ref={overlays.containerRef}>
      <AppHeaderShell {...props} overlays={overlays} />
    </div>
  );
}
