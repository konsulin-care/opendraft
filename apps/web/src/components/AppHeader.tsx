import {
  BookOpenText,
  Check,
  CircleAlert,
  GitCommitHorizontal,
  LoaderCircle,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatFileName } from '../format-file-name';
import { ModeSwitch } from './ModeSwitch';
import type { EditorMode } from './ModeSwitch';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';

export type { EditorMode } from './ModeSwitch';

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
  'inline-flex items-center justify-center gap-1 rounded-md p-2 bg-gray-900 text-white hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500 hidden md:inline-flex';

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
  /** Current editing mode. */
  mode: EditorMode;
  /** Called when the user picks an editing mode. */
  onSelectMode: (mode: EditorMode) => void;
  /** Whether the formatting toolbar is currently shown. */
  formattingToolbar: boolean;
  /** Called when the formatting-toolbar toggle is activated. */
  onToggleFormattingToolbar: () => void;
  /** Called when the Commit action is activated. */
  onCommit: () => void;
}

/**
 * Right-hand header controls: mode switch, toolbar toggle, Commit, and the
 * overflow menu that replaces the first two on small screens.
 *
 * @param props - See {@link HeaderActionsProps}.
 */
function HeaderActions({
  mode,
  onSelectMode,
  formattingToolbar,
  onToggleFormattingToolbar,
  onCommit,
}: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-1">
      <ModeSwitch mode={mode} onSelectMode={onSelectMode} />
      <button
        type="button"
        aria-label="Formatting toolbar"
        title={`${formattingToolbar ? 'Hide' : 'Show'} formatting toolbar (Ctrl/Cmd+\\)`}
        aria-pressed={formattingToolbar}
        onClick={onToggleFormattingToolbar}
        className={ICON_BUTTON}
      >
        <Type className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Commit"
        title="Commit"
        onClick={onCommit}
        className={COMMIT_BUTTON}
      >
        <GitCommitHorizontal className="h-4 w-4" aria-hidden="true" />
        <span className="hidden md:inline">Commit</span>
      </button>
      <HeaderOverflowMenu mode={mode} onSelectMode={onSelectMode} onCommit={onCommit} />
    </div>
  );
}

/** Props for {@link AppHeader}. */
export interface AppHeaderProps {
  /** Full manuscript file name; displayed truncated with the full name in `title`. */
  fileName: string;
  /** Current editing mode. */
  mode: EditorMode;
  /** Called when the user picks an editing mode. */
  onSelectMode: (mode: EditorMode) => void;
  /** Current autosave state. */
  saveStatus: SaveStatus;
  /** Whether the formatting toolbar is currently shown. */
  formattingToolbar: boolean;
  /** Called when the formatting-toolbar toggle is activated. */
  onToggleFormattingToolbar: () => void;
  /** Called when the Commit action is activated. */
  onCommit: () => void;
}

/**
 * Application header: OpenDraft mark, file name, save state, and the
 * header actions.
 *
 * @param props - See {@link AppHeaderProps}.
 */
export function AppHeader({
  fileName,
  mode,
  onSelectMode,
  saveStatus,
  formattingToolbar,
  onToggleFormattingToolbar,
  onCommit,
}: AppHeaderProps) {
  return (
    <header
      className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2"
      data-testid="app-header"
    >
      <button type="button" aria-label="OpenDraft" title="OpenDraft" className={ICON_BUTTON}>
        <BookOpenText className="h-5 w-5" aria-hidden="true" />
      </button>
      <span
        className="min-w-0 flex-1 truncate text-sm text-gray-700"
        style={{ minWidth: 0, overflow: 'hidden' }}
        title={fileName}
      >
        {formatFileName(fileName)}
      </span>
      <SaveIndicator status={saveStatus} />
      <HeaderActions
        mode={mode}
        onSelectMode={onSelectMode}
        formattingToolbar={formattingToolbar}
        onToggleFormattingToolbar={onToggleFormattingToolbar}
        onCommit={onCommit}
      />
    </header>
  );
}
