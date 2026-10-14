import { BookOpenText, GitCommitHorizontal, Type } from 'lucide-react';
import { formatFileName } from '../format-file-name';
import { ModeSwitch } from './ModeSwitch';
import type { EditorMode } from './ModeSwitch';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';

export type { EditorMode } from './ModeSwitch';

/** Props for {@link AppHeader}. */
export interface AppHeaderProps {
  /** Full manuscript file name; displayed truncated with the full name in `title`. */
  fileName: string;
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

const ICON_BUTTON =
  'inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/**
 * Application header: OpenDraft mark, file name, mode switch, formatting
 * toolbar toggle, and Commit. On small screens the mode switch and Commit
 * move into an overflow menu.
 *
 * @param props - See {@link AppHeaderProps}.
 */
export function AppHeader({
  fileName,
  mode,
  onSelectMode,
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
          className={`${ICON_BUTTON} hidden gap-1 md:inline-flex`}
        >
          <GitCommitHorizontal className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">Commit</span>
        </button>
        <HeaderOverflowMenu mode={mode} onSelectMode={onSelectMode} onCommit={onCommit} />
      </div>
    </header>
  );
}
