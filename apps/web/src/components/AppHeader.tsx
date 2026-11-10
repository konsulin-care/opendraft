import {
  BookOpenText,
  Check,
  CircleAlert,
  GitBranch,
  LoaderCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RefObject } from 'react';
import { APP_BAR_HEIGHT } from './app-bar-layout';
import { PROJECT_DRAWER_ID } from './project-drawer/ProjectDrawer';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';
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

const COMMIT_BUTTON =
  'h-9 inline-flex items-center justify-center gap-1 rounded-md p-2 bg-black text-white hover:bg-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500 hidden md:inline-flex';

/** Props for {@link SaveIndicator}. */
interface SaveIndicatorProps {
  /** Current autosave state. */
  status: SaveStatus;
}

/**
 * Autosave state with icon and label, announced politely to screen readers.
 *
 * @param props - See {@link SaveIndicatorProps}.
 */
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
  /** Called when the Commit action is activated. */
  onCommit: () => void;
}

/**
 * Right-hand header controls: Commit and the overflow menu that carries
 * Commit on small screens.
 *
 * @param props - See {@link HeaderActionsProps}.
 */
function HeaderActions({ onCommit }: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Commit"
        title="Commit"
        onClick={onCommit}
        className={COMMIT_BUTTON}
      >
        <GitBranch className="h-4 w-4" aria-hidden="true" />
        <span className="hidden md:inline text-xs">Commit</span>
      </button>
      <HeaderOverflowMenu onCommit={onCommit} />
    </div>
  );
}

/** Props for {@link AppHeader}. */
export interface AppHeaderProps {
  /** @deprecated No longer rendered; kept for legacy callers. */
  fileName?: string;
  /**
   * Name of the active project. Rendered as the second line of the
   * title column when provided.
   */
  projectName?: string;
  /** Display name of the open manuscript (line 1 of the title column). */
  manuscriptName?: string;
  /** Manuscript directory name; used when no display name is set. */
  manuscriptDir?: string;
  /** @deprecated Use {@link AppHeaderProps.onRenameProject}. */
  onRename?: (name: string) => void | Promise<void>;
  /** Called with the trimmed title when the user renames the manuscript. */
  onRenameManuscript?: (name: string) => void | Promise<void>;
  /** Called with the trimmed name when the user renames the project. */
  onRenameProject?: (name: string) => void | Promise<void>;
  /** @deprecated The editor-mode system was removed; ignored. */
  mode?: 'wysiwyg' | 'source';
  /** @deprecated The editor-mode system was removed; ignored. */
  onSelectMode?: (mode: 'wysiwyg' | 'source') => void;
  /** Current autosave state. */
  saveStatus: SaveStatus;
  /** Called when the Commit action is activated. */
  onCommit: () => void;
  /** Called when the book button toggles the project drawer. */
  onToggleSidebar?: () => void;
  /** Whether the project drawer is currently open. */
  sidebarOpen?: boolean;
  /** Receives the book button element so the drawer can return focus to it. */
  toggleButtonRef?: RefObject<HTMLButtonElement | null>;
}

/** Props for {@link HeaderTitle}. */
interface HeaderTitleProps {
  /** Display name of the open manuscript, falling back to the dir name. */
  title?: string;
  /** Name of the active project, rendered below the title when provided. */
  projectName?: string;
  /** Called with the trimmed title when the user renames the manuscript. */
  onRenameManuscript?: (name: string) => void | Promise<void>;
  /** Called with the trimmed name when the user renames the project. */
  onRenameProject?: (name: string) => void | Promise<void>;
}

/**
 * Header title column: the editable manuscript title (line 1) above the
 * editable project name (line 2), left-aligned next to the book icon and
 * kept in an h-9 block so the subtitle clears the header divider.
 *
 * @param props - See {@link HeaderTitleProps}.
 */
function HeaderTitle({ title, projectName, onRenameManuscript, onRenameProject }: HeaderTitleProps) {
  return (
    <span
      className="flex h-9 min-w-0 flex-1 flex-col items-start justify-center text-left"
      data-testid="header-title"
    >
      {title !== undefined && (
        <InlineEditField
          value={title}
          label="Manuscript name"
          testId="manuscript-title"
          onSave={onRenameManuscript}
        />
      )}
      {projectName !== undefined && (
        <InlineEditField
          value={projectName}
          label="Project name"
          testId="project-name"
          inputClassName="text-xs font-normal text-gray-700"
          onSave={onRenameProject}
        />
      )}
    </span>
  );
}

/**
 * Application header: OpenDraft mark, the manuscript title over the
 * project name, save state, and the header actions.
 *
 * @param props - See {@link AppHeaderProps}.
 */
export function AppHeader({
  projectName,
  manuscriptName,
  manuscriptDir,
  onRename, onRenameManuscript, onRenameProject,
  saveStatus,
  onCommit,
  onToggleSidebar,
  sidebarOpen = false,
  toggleButtonRef,
}: AppHeaderProps) {
  return (
    <header
      className={`flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 ${APP_BAR_HEIGHT}`}
      data-testid="app-header"
    >
      <button
        type="button"
        aria-label="OpenDraft"
        title="OpenDraft"
        aria-expanded={sidebarOpen}
        aria-controls={PROJECT_DRAWER_ID}
        onClick={onToggleSidebar}
        ref={toggleButtonRef}
        className={`${ICON_BUTTON} h-9`}
      >
        <BookOpenText className="h-5 w-5" aria-hidden="true" />
      </button>
      <HeaderTitle
        title={manuscriptName ?? manuscriptDir} projectName={projectName}
        onRenameManuscript={onRenameManuscript}
        onRenameProject={onRenameProject ?? onRename}
      />
      <SaveIndicator status={saveStatus} />
      <HeaderActions onCommit={onCommit} />
    </header>
  );
}
