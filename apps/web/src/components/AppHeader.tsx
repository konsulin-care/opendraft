import type { ReactNode, RefObject } from 'react';
import { BookOpenText } from 'lucide-react';
import type { ProjectSource } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import type { HeaderStatus } from '../hooks/draft-header-status';
import { PROJECT_DRAWER_ID } from './project-drawer/ProjectDrawer';
import { DetailsPanel } from './header/DetailsPanel';
import { DraftStateChip } from './header/DraftStateChip';
import { HeaderFrame } from './header/HeaderFrame';
import { InlineEditField } from './InlineEditField';
import { ManuscriptPicker } from './header/ManuscriptPicker';
import { ManuscriptSwitcher } from './header/ManuscriptSwitcher';
import type { ManuscriptSwitcherOption } from './header/ManuscriptSwitcher';
import { RepoSubtitle } from './header/RepoSubtitle';
import { repoSubtitle } from './header/repo-subtitle';
import { TitleTrigger } from './header/TitleTrigger';
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

/** Props for {@link CompactTitle}. */
interface CompactTitleProps {
  /** Display name of the open manuscript, falling back to the dir name. */
  title?: string;
  /** Overlay state driving the details panel. */
  overlays: HeaderOverlays;
  /** Current autosave state. */
  saveStatus: SaveStatus;
  /** Draft status supplying the notice and attention dot. */
  status?: HeaderStatus;
}

/**
 * Title trigger shown below md, opening the manuscript details panel.
 *
 * @param props - See {@link CompactTitleProps}.
 * @returns The trigger with its live save status.
 */
function CompactTitle({ title, overlays, saveStatus, status }: CompactTitleProps) {
  return (
    <TitleTrigger
      title={title}
      open={overlays.view !== 'closed'}
      panelId={DETAILS_PANEL_ID}
      onToggle={overlays.toggleDetails}
      triggerRef={overlays.triggerRef}
      saveStatus={saveStatus}
      notice={status?.notice}
      attention={status?.attention}
    />
  );
}

/** Props for {@link WideTitle}. */
interface WideTitleProps {
  /** Display name of the open manuscript, falling back to the dir name. */
  title?: string;
  /** Manuscripts offered by the desktop switcher. */
  manuscripts?: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  currentId?: string;
  /** Called with the id chosen in the desktop switcher. */
  onSelect?: (id: string) => void;
  /** Called with the trimmed name when the desktop field saves. */
  onRename?: (value: string) => void | Promise<void>;
}

/**
 * Inline editable title plus switcher, shown from md up.
 *
 * @param props - See {@link WideTitleProps}.
 * @returns The editable name and its optional switcher.
 */
function WideTitle({ title, manuscripts, currentId, onSelect, onRename }: WideTitleProps) {
  const canSwitch = (manuscripts?.length ?? 0) >= 2 && onSelect !== undefined;
  return (
    <>
      {title !== undefined && (
        <InlineEditField
          value={title}
          label="Manuscript name"
          testId="manuscript-title-inline"
          onSave={onRename}
        />
      )}
      {canSwitch && onSelect !== undefined && (
        <ManuscriptSwitcher
          manuscripts={manuscripts ?? []}
          currentId={currentId}
          onSelect={onSelect}
        />
      )}
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

/**
 * Pick the overlay surface for the current header view.
 *
 * @param props - Header props carrying the manuscript data and handlers.
 * @param overlays - Overlay state and actions driving the surface.
 * @param title - Resolved manuscript title shown in the details panel.
 * @returns The details panel, the manuscript picker, or null when closed.
 */
function panelSlot(
  props: AppHeaderProps,
  overlays: HeaderOverlays,
  title: string | undefined,
): ReactNode {
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

/**
 * Editor header built on the shared responsive header frame: drawer toggle,
 * title trigger with its live save status below md (opening a details panel
 * with the editable manuscript name, the draft status and the picker), the
 * inline editable title and switcher from md up, the read-only repo subtitle,
 * the main action and the account menu.
 *
 * @param props - See {@link AppHeaderProps}.
 * @returns The editor header with its optional overlay surface.
 */
export function AppHeader(props: AppHeaderProps) {
  const title = props.manuscriptName ?? props.manuscriptDir;
  return (
    <HeaderFrame
      testId="app-header"
      leading={
        <DrawerToggle
          sidebarOpen={props.sidebarOpen ?? false}
          onToggle={props.onToggleSidebar}
          toggleButtonRef={props.toggleButtonRef}
        />
      }
      compact={(overlays) => (
        <CompactTitle
          title={title}
          overlays={overlays}
          saveStatus={props.saveStatus}
          status={props.status}
        />
      )}
      wide={
        <WideTitle
          title={title}
          manuscripts={props.manuscripts}
          currentId={props.manuscriptId}
          onSelect={props.onSelectManuscript}
          onRename={props.onRenameManuscript}
        />
      }
      subtitle={props.source ? <RepoSubtitle {...repoSubtitle(props.source)} /> : undefined}
      action={
        <div className="flex min-w-0 items-center gap-1.5">
          {props.status?.draftLabel ? <DraftStateChip label={props.status.draftLabel} /> : null}
          {props.action}
        </div>
      }
      userMenu={
        <UserMenu
          session={props.session ?? null}
          returnTo={props.returnTo ?? '/'}
          onLogout={props.onLogout ?? NOOP_LOGOUT}
          loginEnabled={props.loginEnabled ?? true}
        />
      }
      sidebarOpen={props.sidebarOpen ?? false}
      panel={(overlays) => panelSlot(props, overlays, title)}
    />
  );
}

export default AppHeader;
