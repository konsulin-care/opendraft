/**
 * Block header: the collapsible block's title row, owning the H1 title,
 * the level-1 warning badge, the word count, the save status and the
 * delete button. The disclosure
 * toggle carries `aria-expanded`. The warning badge reflects the body
 * as loaded: new level-1 headings cannot appear because the body's
 * heading guard demotes them to H2.
 */
import { useSyncExternalStore } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { SaveStatus } from '../components/AppHeader';
import { InlineEditField } from '../components/InlineEditField';

/** Per-block level-1 warnings reported by mounted bodies, keyed by short name. */
const level1Warnings = new Map<string, boolean>();
/** Listeners notified when any block's level-1 warning changes. */
const level1Listeners = new Set<() => void>();

/**
 * Whether a loaded block body carries a level-1 heading (an ATX `# `
 * line outside a fenced code block). The canonical heading line has
 * already been stripped by the caller.
 *
 * @param body - Loaded block body text.
 * @returns True when the body contains a level-1 heading.
 */
function bodyHasLevel1(body: string): boolean {
  let fence: string | null = null;
  for (const line of body.split('\n')) {
    const trimmed = line.trimStart();
    if (fence !== null) {
      if (trimmed.startsWith(fence)) fence = null;
      continue;
    }
    const open = trimmed.match(/^(```|~~~)/);
    if (open) {
      fence = open[1];
      continue;
    }
    if (/^ {0,3}# /.test(line)) return true;
  }
  return false;
}

/**
 * Report a block's loaded body so its header can show a warning badge
 * when the body already contains a level-1 heading. Read-only with
 * respect to the workspace: the file itself is never rewritten here.
 *
 * @param short - Block short name the body belongs to.
 * @param body - Loaded body text with the canonical heading stripped.
 */
export function reportLoadedBody(short: string, body: string): void {
  const hasLevel1 = bodyHasLevel1(body);
  if ((level1Warnings.get(short) ?? false) === hasLevel1) return;
  level1Warnings.set(short, hasLevel1);
  level1Listeners.forEach((listener) => listener());
}

/**
 * Subscribe to level-1 warning changes.
 *
 * @param listener - Called after any block's warning changes.
 * @returns An unsubscribe function.
 */
function subscribeLevel1Warning(listener: () => void): () => void {
  level1Listeners.add(listener);
  return () => {
    level1Listeners.delete(listener);
  };
}

/** Save-status labels, mirroring the app header indicator. */
const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving',
  error: 'Save failed',
};

/** Props for {@link BlockHeader}. */
export interface BlockHeaderProps {
  /** Block short name — the file name without `.qmd`. */
  short: string;
  /** Section title rendered as the header H1. */
  title: string;
  /** Whether the block body is collapsed. */
  collapsed: boolean;
  /** Flip the collapsed state; wired to the disclosure toggle. */
  onToggle: () => void;
  /** Word count of the section body. */
  wordCount: number;
  /** Autosave state shown next to the word count. */
  saveStatus: SaveStatus;
  /** Open the delete confirmation for this block's section. */
  onOverflow?: () => void;
  /**
   * Save an edited header title — wired to `useBlocks().setTitle`.
   * When omitted the header renders a static H1 instead of the
   * inline-edit field.
   */
  onTitleSave?: (title: string) => void | Promise<void>;
}

/**
 * Amber badge shown when the loaded body already contains a level-1
 * heading; read-only signal rendered only while the warning is on.
 *
 * @returns The warning badge markup.
 */
function Level1Badge() {
  return (
    <span
      data-testid="level-1-warning-badge"
      title="Body contains a level-1 heading"
      className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
    >
      H1 in body
    </span>
  );
}

/**
 * Header title: the inline-edit field when a save handler is wired,
 * otherwise the static H1 so consumers without rename support keep
 * their level-1 heading.
 *
 * @param props - Title value and the optional save handler.
 * @returns The title markup.
 */
function HeaderTitle({
  title,
  onTitleSave,
}: {
  title: string;
  onTitleSave?: (title: string) => void | Promise<void>;
}) {
  if (onTitleSave === undefined) {
    return <h1 className="flex-1 truncate text-base font-semibold text-gray-900">{title}</h1>;
  }
  return (
    <span className="min-w-0 flex-1">
      <InlineEditField
        value={title}
        label="Section title"
        testId="block-title"
        onSave={onTitleSave}
        inputClassName="text-base font-semibold"
      />
    </span>
  );
}

/**
 * Word count and save status shown right of the title.
 *
 * @param props - Word count and autosave state.
 * @returns The word count and status markup.
 */
function HeaderStatus({ wordCount, saveStatus }: { wordCount: number; saveStatus: SaveStatus }) {
  return (
    <>
      <span className="text-xs text-gray-500">
        {wordCount} {wordCount === 1 ? 'word' : 'words'}
      </span>
      <span role="status" aria-live="polite" className="text-xs text-gray-600">
        {SAVE_LABEL[saveStatus]}
      </span>
    </>
  );
}

/**
 * Header row of one block: disclosure toggle, H1 title,
 * word count, save status and delete button.
 *
 * @param props - See {@link BlockHeaderProps}.
 * @returns The rendered header markup.
 */
export function BlockHeader({
  short,
  title,
  collapsed,
  onToggle,
  wordCount,
  saveStatus,
  onOverflow,
  onTitleSave,
}: BlockHeaderProps) {
  const hasLevel1Warning = useSyncExternalStore(
    subscribeLevel1Warning,
    () => level1Warnings.get(short) ?? false,
    () => false,
  );
  return (
    <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
      <button
        type="button"
        aria-label={`${title} section`}
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-gray-100"
      >
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>
      <HeaderTitle title={title} onTitleSave={onTitleSave} />
      {hasLevel1Warning && <Level1Badge />}
      <HeaderStatus wordCount={wordCount} saveStatus={saveStatus} />
      <button
        type="button"
        aria-label="Delete section"
        onClick={onOverflow}
        className="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-gray-100"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </button>
    </header>
  );
}
